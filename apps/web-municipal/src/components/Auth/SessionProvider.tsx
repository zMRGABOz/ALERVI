"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { canUseDemoSession, DEMO_PROFILE_STORAGE_KEY } from "../../config/demo-session";
import { env } from "../../config/env";
import { demoUsers } from "../../mocks/fixtures";
import { ApiError, type RequestOptions } from "../../services/api";
import { login, type LoginRequest } from "../../services/auth";
import { subscribeSessionInvalidation } from "../../services/session-invalidation";
import { registerQuerySession } from "../../services/query-cache";
import { DEMO_TOKEN_PREFIX } from "../../services/transport";
import {
  isSessionRole,
  isSessionUser,
  type Session,
  type SessionRole,
  type SessionStatus,
  type SessionUser,
  type RealSession,
} from "../../types/session";

type SessionEndReason = "expired" | "logout" | null;
type RealIdentity = Pick<RealSession, "source" | "usuario" | "accessToken" | "expiresAt">;
type Identity = { source: "demo"; usuario: SessionUser; accessToken: null } | RealIdentity;
type RestoredSession = { identity: RealIdentity | null; endReason: SessionEndReason };

const REAL_SESSION_STORAGE_KEY = "alervi.real-session";

type SessionSnapshot = {
  status: SessionStatus;
  session: Session | null;
  demoAllowed: boolean;
  configuration: string | null;
  endReason: SessionEndReason;
};

type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  usuario: SessionUser | null;
  rol: SessionRole | null;
  source: Session["source"] | null;
  accessToken: string | null;
  demoAllowed: boolean;
  endReason: SessionEndReason;
  signIn: (credentials: LoginRequest, options?: RequestOptions) => Promise<void>;
  logout: () => void;
  setDemoRole: (role: SessionRole) => void;
};

const INITIAL_SNAPSHOT: SessionSnapshot = {
  status: "initializing",
  session: null,
  demoAllowed: false,
  configuration: null,
  endReason: null,
};

export const SessionContext = createContext<SessionContextValue | null>(null);

function readDemoRole(): SessionRole {
  try {
    const preference = window.sessionStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
    if (isSessionRole(preference)) return preference;
    if (preference !== null) window.sessionStorage.removeItem(DEMO_PROFILE_STORAGE_KEY);
  } catch {
    // La sesión local funciona también con almacenamiento bloqueado.
  }
  return "inspector";
}

function persistRealSession(session: Session | null, configuration: string | null) {
  try {
    if (session?.source === "real" && env.apiMode !== "mock" && configuration) {
      window.sessionStorage.setItem(REAL_SESSION_STORAGE_KEY, JSON.stringify({
        version: 1,
        configuration,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        usuario: session.usuario,
      }));
    } else {
      window.sessionStorage.removeItem(REAL_SESSION_STORAGE_KEY);
    }
  } catch {
    // Con almacenamiento bloqueado, la sesión actual sigue funcionando en memoria.
  }
}

function restoreRealSession(configuration: string): RestoredSession {
  const empty: RestoredSession = { identity: null, endReason: null };
  if (env.apiMode === "mock") return empty;
  try {
    const raw = window.sessionStorage.getItem(REAL_SESSION_STORAGE_KEY);
    if (raw === null) return empty;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Sesión almacenada inválida");
    const stored = value as Record<string, unknown>;
    if (
      stored.version !== 1 || stored.configuration !== configuration ||
      typeof stored.accessToken !== "string" || !stored.accessToken || /[^\u0021-\u007e]/.test(stored.accessToken) || stored.accessToken.startsWith(DEMO_TOKEN_PREFIX) ||
      typeof stored.expiresAt !== "number" || !Number.isSafeInteger(stored.expiresAt) ||
      !isSessionUser(stored.usuario) || !stored.usuario.activo
    ) throw new Error("Sesión almacenada inválida");
    if (stored.expiresAt <= Date.now()) {
      persistRealSession(null, null);
      return { identity: null, endReason: "expired" };
    }
    const user = stored.usuario;
    return {
      identity: {
        source: "real",
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt,
        usuario: { id_usuario: user.id_usuario, correo: user.correo, rol: user.rol, activo: user.activo, fecha_creacion: user.fecha_creacion },
      },
      endReason: null,
    };
  } catch {
    persistRealSession(null, null);
    return empty;
  }
}

function createSessionStore() {
  let snapshot = INITIAL_SNAPSHOT;
  let controller: AbortController | null = null;
  let loginController: AbortController | null = null;
  let expirationTimer: ReturnType<typeof setTimeout> | null = null;
  let revision = 0;
  const listeners = new Set<() => void>();

  function replaceSession(
    identity: Identity | null,
    demoAllowed: boolean,
    configuration: string | null,
    endReason: SessionEndReason = null,
  ) {
    if (expirationTimer !== null) clearTimeout(expirationTimer);
    expirationTimer = null;
    controller?.abort();
    controller = identity === null ? null : new AbortController();
    revision += 1;
    const session: Session | null = identity && controller ? {
      ...identity,
      rol: identity.usuario.rol,
      revision,
      signal: controller.signal,
    } : null;
    if (session) registerQuerySession(session);

    snapshot = {
      configuration,
      demoAllowed,
      endReason,
      status: session ? "available" : "anonymous",
      session,
    };
    persistRealSession(session, configuration);
    if (session?.source === "real") checkExpiration();
    listeners.forEach((listener) => listener());
  }

  function checkExpiration() {
    if (expirationTimer !== null) clearTimeout(expirationTimer);
    expirationTimer = null;
    if (snapshot.session?.source !== "real") return;
    const remaining = snapshot.session.expiresAt - Date.now();
    if (remaining <= 0) replaceSession(null, snapshot.demoAllowed, snapshot.configuration, "expired");
    else expirationTimer = setTimeout(checkExpiration, Math.min(remaining, 2_147_483_647));
  }

  function cancelLogin() {
    loginController?.abort();
    loginController = null;
  }

  function demoIdentity(role: SessionRole): Identity {
    return { source: "demo", usuario: { ...demoUsers[role] }, accessToken: null };
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize(configuration: string) {
      cancelLogin();
      const allowed = canUseDemoSession();
      const restored = restoreRealSession(configuration);
      replaceSession(allowed ? demoIdentity(readDemoRole()) : restored.identity, allowed, configuration, restored.endReason);
    },
    async signIn(credentials: LoginRequest, options: RequestOptions = {}) {
      cancelLogin();
      const request = new AbortController();
      loginController = request;
      const configuration = snapshot.configuration;
      const cancel = () => request.abort();
      if (options.signal?.aborted) cancel();
      else options.signal?.addEventListener("abort", cancel, { once: true });
      try {
        const result = await login(credentials, { ...options, signal: request.signal });
        if (request.signal.aborted || loginController !== request || snapshot.configuration !== configuration) {
          throw new ApiError("La solicitud fue cancelada.", { status: 0, code: "SOLICITUD_CANCELADA" });
        }
        replaceSession({ source: "real", usuario: result.usuario, accessToken: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 }, false, configuration);
      } finally {
        options.signal?.removeEventListener("abort", cancel);
        if (loginController === request) loginController = null;
      }
    },
    logout() {
      cancelLogin();
      replaceSession(null, snapshot.demoAllowed, snapshot.configuration, "logout");
    },
    invalidate(session: RealSession) {
      if (snapshot.session === session) replaceSession(null, snapshot.demoAllowed, snapshot.configuration, "expired");
    },
    checkExpiration,
    setDemoRole(role: SessionRole) {
      if (
        !isSessionRole(role) || !canUseDemoSession() ||
        snapshot.session?.source !== "demo" || snapshot.session.rol === role
      ) return;

      try {
        window.sessionStorage.setItem(DEMO_PROFILE_STORAGE_KEY, role);
      } catch {
        // La selección actual sigue siendo válida, aunque no pueda recordarse.
      }
      replaceSession(demoIdentity(role), true, snapshot.configuration);
    },
    dispose() {
      cancelLogin();
      if (expirationTimer !== null) clearTimeout(expirationTimer);
      controller?.abort();
    },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSessionStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const configuration = `${env.apiMode}:${env.apiBaseUrl}`;
  const snapshot = state.configuration === configuration ? state : INITIAL_SNAPSHOT;

  useEffect(() => {
    store.initialize(configuration);
    const unsubscribe = subscribeSessionInvalidation(store.invalidate);
    window.addEventListener("focus", store.checkExpiration);
    document.addEventListener("visibilitychange", store.checkExpiration);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", store.checkExpiration);
      document.removeEventListener("visibilitychange", store.checkExpiration);
      store.dispose();
    };
  }, [configuration, store]);

  const value = useMemo<SessionContextValue>(() => ({
    status: snapshot.status,
    session: snapshot.session,
    usuario: snapshot.session?.usuario ?? null,
    rol: snapshot.session?.rol ?? null,
    source: snapshot.session?.source ?? null,
    accessToken: snapshot.session?.accessToken ?? null,
    demoAllowed: snapshot.demoAllowed,
    endReason: snapshot.endReason,
    signIn: store.signIn,
    logout: store.logout,
    setDemoRole: store.setDemoRole,
  }), [snapshot, store]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
