import { env } from "../config/env";
import type { Session } from "../types/session";
import { ApiError, type RequestOptions } from "./api";
import { invalidateSession } from "./session-invalidation";

export type CachedQueryState<T> = (
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: ApiError }
) & { revision: number; refreshing: boolean };

export const EMPTY_QUERY = { status: "loading", data: null, error: null, revision: 0, refreshing: false } as const;
const publicQueries = new Map<string, CachedQuery<unknown>>();
const privateQueries = new WeakMap<Session, Map<string, CachedQuery<unknown>>>();
const MAX_INACTIVE_QUERIES = 100;

function queryPrefix(name: string) {
  return `${env.apiMode}:${env.apiBaseUrl}|${name}|`;
}

export function queryKey(name: string, parameters: object = {}): string {
  const entries = Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right));
  return `${queryPrefix(name)}${JSON.stringify(entries)}`;
}

function cancelled() {
  return new ApiError("La solicitud fue cancelada.", { status: 0, code: "SOLICITUD_CANCELADA" });
}

class CachedQuery<T> {
  private state: CachedQueryState<T> = EMPTY_QUERY;
  private fresh = false;
  private pending: Promise<T> | null = null;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();

  constructor(private session?: Session) {}

  getSnapshot = (): CachedQueryState<T> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  get inactive() { return !this.listeners.size && !this.pending; }

  private publish(state: CachedQueryState<T>) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  invalidate = (clear = false) => {
    this.controller?.abort();
    this.controller = null;
    this.pending = null;
    this.fresh = false;
    const revision = this.state.revision + 1;
    this.publish(!clear && this.state.status === "success"
      ? { ...this.state, revision, refreshing: true }
      : { ...EMPTY_QUERY, revision });
  };

  load(loader: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.session?.signal.aborted) return Promise.reject(cancelled());
    if (this.session?.source === "real" && this.session.expiresAt <= Date.now()) {
      invalidateSession(this.session);
      return Promise.reject(new ApiError("La sesión ha expirado.", { status: 401, code: "SESION_EXPIRADA" }));
    }
    if (this.fresh && this.state.status === "success") return Promise.resolve(this.state.data);
    if (this.pending) return this.pending;

    const controller = new AbortController();
    this.controller = controller;
    const revision = this.state.revision;
    this.publish(this.state.status === "success" ? { ...this.state, refreshing: true } : { ...EMPTY_QUERY, revision });
    this.pending = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return loader(controller.signal);
    }).then((data) => {
      controller.signal.throwIfAborted();
      if (this.controller === controller) {
        this.fresh = true;
        this.publish({ status: "success", data, error: null, revision, refreshing: false });
      }
      return data;
    }).catch((reason: unknown) => {
      const error = controller.signal.aborted ? cancelled() : reason instanceof ApiError ? reason
        : new ApiError("No se pudo consultar la información. Intenta nuevamente.", { status: 0, code: "ERROR_CONSULTA" });
      if (this.controller === controller && !controller.signal.aborted) {
        this.publish({ status: "error", data: null, error, revision, refreshing: false });
      }
      throw error;
    }).finally(() => {
      if (this.controller === controller) {
        this.controller = null;
        this.pending = null;
      }
    });
    return this.pending;
  }
}

function scope(session?: Session) {
  if (!session) return publicQueries;
  return privateQueries.get(session);
}

// La reutilización privada pertenece a la sesión vigente del proveedor municipal.
export function registerQuerySession(session: Session) {
  if (session.signal.aborted || privateQueries.has(session)) return;
  const queries = new Map<string, CachedQuery<unknown>>();
  privateQueries.set(session, queries);
  session.signal.addEventListener("abort", () => {
    queries.forEach((query) => query.invalidate(true));
    queries.clear();
    privateQueries.delete(session);
  }, { once: true });
}

export function getCachedQuery<T>(key: string, session?: Session): CachedQuery<T> {
  const queries = scope(session);
  if (!queries) return new CachedQuery<T>(session);
  let query = queries.get(key);
  if (!query) {
    query = new CachedQuery<unknown>(session);
    queries.set(key, query);
    if (queries.size > MAX_INACTIVE_QUERIES) {
      for (const [oldKey, oldQuery] of queries) {
        if (queries.size <= MAX_INACTIVE_QUERIES) break;
        if (oldKey !== key && oldQuery.inactive) queries.delete(oldKey);
      }
    }
  } else {
    // Las consultas visitadas recientemente se conservan antes que las inactivas.
    queries.delete(key);
    queries.set(key, query);
  }
  return query as CachedQuery<T>;
}

export function invalidateQueryGroup(name: string, session?: Session) {
  const prefix = queryPrefix(name);
  scope(session)?.forEach((query, key) => { if (key.startsWith(prefix)) query.invalidate(); });
}

export function invalidateInspectionQueries(session: Session, idPunto?: number) {
  invalidateQueryGroup("inspection-summary", session);
  invalidateQueryGroup("ranking", session);
  for (const name of ["point-detail", "inspection-context", "inspection-history"]) {
    if (idPunto === undefined) invalidateQueryGroup(name, session);
    else getCachedQuery(queryKey(name, { id: idPunto }), session).invalidate();
  }
  invalidateQueryGroup("risk-points");
}

export async function readCachedQuery<T>(
  key: string,
  options: RequestOptions & { session?: Session },
  loader: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (options.signal?.aborted) throw cancelled();
  const pending = getCachedQuery<T>(key, options.session).load(loader);
  if (!options.signal) return pending;
  const signal = options.signal;
  // Cancelar una vista no cancela una consulta compartida por otra sección.
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(cancelled()); };
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
