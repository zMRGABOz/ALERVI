import type { components } from "./api.generated";

export type SessionUser = components["schemas"]["UsuarioResponse"];
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
