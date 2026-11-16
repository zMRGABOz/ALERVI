import type { components } from "./api.generated";

export type SessionUser = Omit<components["schemas"]["UsuarioResponse"], "fecha_creacion"> & {
  // El backend puede no informar esta fecha; no se inventa una al autenticar.
  fecha_creacion: string | null;
};
export type SessionRole = SessionUser["rol"];
export type SessionStatus = "initializing" | "anonymous" | "available";

type SessionBase = {
  usuario: SessionUser;
  rol: SessionRole;
  revision: number;
  signal: AbortSignal;
};

export type DemoSession = SessionBase & {
  source: "demo";
  accessToken: null;
};

export type RealSession = SessionBase & {
  source: "real";
  accessToken: string;
  expiresAt: number;
};

export type Session = DemoSession | RealSession;

export const sessionRoleLabels: Record<SessionRole, string> = {
  inspector: "Inspector municipal",
  administrador: "Administrador",
};

export function isSessionRole(value: unknown): value is SessionRole {
  return value === "inspector" || value === "administrador";
}

export function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id_usuario === "number" && Number.isSafeInteger(user.id_usuario) && user.id_usuario > 0 &&
    typeof user.correo === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.correo) &&
    isSessionRole(user.rol) && typeof user.activo === "boolean" &&
    (user.fecha_creacion === null || (typeof user.fecha_creacion === "string" && Number.isFinite(Date.parse(user.fecha_creacion))))
  );
}
