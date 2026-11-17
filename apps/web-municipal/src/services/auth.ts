import { env } from "../config/env";
import type { components } from "../types/api.generated";
import { isSessionUser, type SessionUser } from "../types/session";
import { ApiError, apiRequest, type RequestOptions } from "./api";
import { DEMO_TOKEN_PREFIX } from "./transport";

export type LoginRequest = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];

export type LoginErrorKind = "credentials" | "locked" | "mfa-required" | "mfa-invalid" | "validation" | "unavailable" | "invalid-response";

export class LoginError extends ApiError {
  constructor(readonly kind: LoginErrorKind, message: string, options: { status: number; code: string }) {
    super(message, options);
    this.name = "LoginError";
  }
}

export type AuthenticatedLogin = {
  accessToken: string;
  expiresIn: number;
  usuario: SessionUser;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
  throw new LoginError("invalid-response", "El servicio no entregó una autenticación completa y válida. Intenta nuevamente.", {
    status: 200,
    code: "RESPUESTA_AUTH_INVALIDA",
  });
}

function authenticatedLogin(value: unknown): AuthenticatedLogin {
  if (!isRecord(value)) return invalidResponse();
  if (value.mfa_requerido === true) {
    throw new LoginError("mfa-required", "Se requiere un segundo factor. Ingresa tu código de verificación de seis dígitos para continuar.", {
      status: 401,
      code: "MFA_REQUERIDO",
    });
  }
  const user = value.usuario;
  if (
    (value.mfa_requerido !== undefined && value.mfa_requerido !== false) ||
    typeof value.access_token !== "string" || !value.access_token || /[^\u0021-\u007e]/.test(value.access_token) ||
    value.access_token.startsWith(DEMO_TOKEN_PREFIX) ||
    typeof value.token_type !== "string" || value.token_type.toLowerCase() !== "bearer" ||
    !Number.isSafeInteger(value.expires_in) || typeof value.expires_in !== "number" || value.expires_in <= 0 ||
    !Number.isSafeInteger(Date.now() + value.expires_in * 1000) ||
    !isSessionUser(user) || !user.activo
  ) return invalidResponse();

  return {
    accessToken: value.access_token,
    expiresIn: value.expires_in,
    usuario: {
      id_usuario: user.id_usuario,
      correo: user.correo,
      rol: user.rol,
      activo: true,
      fecha_creacion: user.fecha_creacion,
    },
  };
}

function loginError(error: ApiError): LoginError {
  const text = `${error.code} ${error.message}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (error.status === 401 && /mfa|segundo factor/.test(text)) {
    if (/requerid|required|necesari/.test(text)) {
      return new LoginError("mfa-required", "Se requiere un segundo factor. Ingresa tu código de verificación de seis dígitos para continuar.", error);
    }
    if (/invalid|incorrect|expirad|vencid/.test(text)) {
      return new LoginError("mfa-invalid", "El código de verificación es incorrecto o expiró. Ingresa un código vigente.", error);
    }
  }
  if ([403, 423, 429].includes(error.status)) {
    return new LoginError("locked", "La cuenta está bloqueada temporalmente por los intentos de acceso. Intenta más tarde.", error);
  }
  if (error.status === 401) {
    return new LoginError("credentials", "El correo o la contraseña son incorrectos.", error);
  }
  if (error.status === 422 && error.validationIssues.some((issue) => issue.path.includes("codigo_mfa"))) {
    return new LoginError("mfa-invalid", "El código de verificación debe contener seis dígitos.", error);
  }
  if (error.status === 400 || error.status === 422) {
    return new LoginError("validation", "Revisa el correo, la contraseña y el código de verificación si fue solicitado.", error);
  }
  return new LoginError("unavailable", error.message, error);
}

export async function login(
  credentials: LoginRequest,
  options: RequestOptions = {},
): Promise<AuthenticatedLogin> {
  if (env.apiMode === "mock") {
    throw new LoginError("unavailable", "El inicio de sesión con credenciales requiere una conexión API.", { status: 0, code: "LOGIN_NO_DISPONIBLE_EN_MOCK" });
  }
  try {
    return authenticatedLogin(await apiRequest<unknown>("/api/v1/auth/login", {
      method: "POST",
      body: credentials,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }));
  } catch (error) {
    if (error instanceof LoginError) throw error;
    if (error instanceof ApiError) throw loginError(error);
    throw new LoginError("unavailable", "No fue posible iniciar sesión. Intenta nuevamente.", { status: 0, code: "ERROR_LOGIN" });
  }
}
