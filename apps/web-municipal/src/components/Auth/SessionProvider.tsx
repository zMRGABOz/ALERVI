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
import {
  isSessionRole,
  type Session,
  type SessionRole,
  type SessionStatus,
  type SessionUser,
} from "../../types/session";

type SessionSnapshot = {
  status: SessionStatus;
  session: Session | null;
  demoAllowed: boolean;
  configuration: string | null;
};

type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  usuario: SessionUser | null;
  rol: SessionRole | null;
  source: Session["source"] | null;
  accessToken: string | null;
  demoAllowed: boolean;
  logout: () => void;
  setDemoRole: (role: SessionRole) => void;
};

const INITIAL_SNAPSHOT: SessionSnapshot = {
  status: "initializing",
  session: null,
  demoAllowed: false,
  configuration: null,
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

function createSessionStore() {
  let snapshot = INITIAL_SNAPSHOT;
  let controller: AbortController | null = null;
  let revision = 0;
  const listeners = new Set<() => void>();

  function replaceSession(
    role: SessionRole | null,
    demoAllowed: boolean,
    configuration: string | null,
  ) {
    controller?.abort();
    controller = role === null ? null : new AbortController();
    revision += 1;
    const usuario = role === null ? null : { ...demoUsers[role] };

    snapshot = {
      configuration,
      demoAllowed,
      status: usuario && controller ? "available" : "anonymous",
      session: usuario && controller ? {
        source: "demo",
        usuario,
        rol: usuario.rol,
        accessToken: null,
        revision,
        signal: controller.signal,
      } : null,
    };
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize(configuration: string) {
      const allowed = canUseDemoSession();
      replaceSession(allowed ? readDemoRole() : null, allowed, configuration);
    },
    logout() {
      if (!snapshot.session) return;
      replaceSession(null, snapshot.demoAllowed, snapshot.configuration);
    },
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
      replaceSession(role, true, snapshot.configuration);
    },
    dispose() {
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
    return store.dispose;
  }, [configuration, store]);

  const value = useMemo<SessionContextValue>(() => ({
    status: snapshot.status,
    session: snapshot.session,
    usuario: snapshot.session?.usuario ?? null,
    rol: snapshot.session?.rol ?? null,
    source: snapshot.session?.source ?? null,
    accessToken: snapshot.session?.accessToken ?? null,
    demoAllowed: snapshot.demoAllowed,
    logout: store.logout,
    setDemoRole: store.setDemoRole,
  }), [snapshot, store]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
