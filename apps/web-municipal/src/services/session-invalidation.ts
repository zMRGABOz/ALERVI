import type { RealSession } from "../types/session";

const listeners = new Set<(session: RealSession) => void>();

export function subscribeSessionInvalidation(listener: (session: RealSession) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function invalidateSession(session: RealSession): void {
  listeners.forEach((listener) => listener(session));
}
