import { canUseDemoSession } from "../config/demo-session";
import { env } from "../config/env";
import type { Session } from "../types/session";
import { invalidateSession } from "./session-invalidation";

export type ApiTransport = (
  url: URL,
  options: RequestInit,
  session?: Session,
) => Promise<Response>;

export const DEMO_TOKEN_PREFIX = "alervi-demo:";

export class TransportSessionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "TransportSessionError";
  }
}

export const transport: ApiTransport = async (url, options, session) => {
  session?.signal.throwIfAborted();
  const signal = options.signal && session
    ? AbortSignal.any([options.signal, session.signal])
    : options.signal ?? session?.signal;

  const headers = new Headers(options.headers);
  const authorization = headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (
    token?.startsWith(DEMO_TOKEN_PREFIX) ||
    (session?.source === "real" && typeof session.accessToken === "string" &&
      session.accessToken.startsWith(DEMO_TOKEN_PREFIX))
  ) {
    throw new TransportSessionError(
      "Los tokens antiguos de demostración no son válidos. Recarga la sesión local.",
      "TOKEN_DEMO_NO_PERMITIDO",
    );
  }

  if (env.apiMode === "mock") {
    if (authorization || (session && (session.source !== "demo" || !canUseDemoSession()))) {
      throw new TransportSessionError(
        "Las operaciones privadas mock requieren una sesión de demostración local.",
        "SESION_DEMO_NO_DISPONIBLE",
      );
    }
    const { mockTransport } = await import("../mocks/transport");
    return mockTransport(url, { ...options, signal }, session);
  }

  if (session?.source === "demo") {
    throw new TransportSessionError(
      "La identidad de demostración no puede autorizar solicitudes HTTP.",
      "SESION_DEMO_NO_PERMITIDA",
    );
  }

  if (session || authorization) {
    if (
      session?.source !== "real" || typeof session.accessToken !== "string" ||
      !session.accessToken || /[^\u0021-\u007e]/.test(session.accessToken) ||
      (authorization !== null && authorization !== `Bearer ${session.accessToken}`) ||
      !session.usuario.activo
    ) {
      throw new TransportSessionError(
        "Se requiere una sesión real válida para continuar.",
        "SESION_REQUERIDA",
      );
    }
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      invalidateSession(session);
      throw new TransportSessionError("La sesión ha expirado.", "SESION_EXPIRADA");
    }
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(url, { ...options, headers, signal });
  if (session?.source === "real" && response.status === 401) invalidateSession(session);
  return response;
};
