import { env } from "../config/env";
import type { Session } from "../types/session";
import { TransportSessionError, transport } from "./transport";

export type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type AuthenticatedRequestOptions = RequestOptions & {
  session: Session;
};

type QueryValue = string | number | boolean | null | undefined;

type ApiRequestOptions = RequestOptions & {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Readonly<Record<string, QueryValue>>;
  body?: unknown;
} & (
    | { auth?: "public"; session?: never }
    | { auth: "required"; session: Session }
  );

export type ApiValidationIssue = Readonly<{
  path: readonly (string | number)[];
  message: string;
}>;

type ApiErrorOptions = {
  status: number;
  code: string;
  validationIssues?: readonly ApiValidationIssue[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly validationIssues: readonly ApiValidationIssue[];

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.validationIssues = options.validationIssues ?? [];
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFieldPath(value: unknown): value is (string | number)[] {
  return (
    Array.isArray(value) &&
    value.every(
      (part: unknown) =>
        typeof part === "string" ||
        (typeof part === "number" && Number.isFinite(part)),
    )
  );
}

function getValidationIssues(body: unknown): ApiValidationIssue[] {
  if (!isRecord(body) || !Array.isArray(body.detail)) return [];

  const issues: ApiValidationIssue[] = [];

  for (const value of body.detail) {
    if (
      isRecord(value) &&
      isFieldPath(value.loc) &&
      typeof value.msg === "string"
    ) {
      issues.push({ path: value.loc, message: value.msg });
    }
  }

  return issues;
}

function getHttpMessage(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "Revisa los datos enviados e intenta nuevamente.";
    case 401:
      return "Las credenciales no son válidas o la sesión ha expirado.";
    case 403:
      return "No tienes permiso para realizar esta acción.";
    case 404:
      return "El recurso solicitado no está disponible.";
    case 423:
      return "La cuenta está bloqueada temporalmente.";
    default:
      return status >= 500
        ? "El servicio no está disponible en este momento. Intenta nuevamente."
        : "La solicitud no pudo completarse.";
  }
}

function createHttpError(status: number, body: unknown): ApiError {
  const code =
    isRecord(body) && typeof body.codigo === "string" && body.codigo.trim()
      ? body.codigo
      : `HTTP_${status}`;
  const message =
    status < 500 &&
    isRecord(body) &&
    typeof body.mensaje === "string" &&
    body.mensaje.trim()
      ? body.mensaje
      : getHttpMessage(status);

  return new ApiError(message, {
    status,
    code,
    validationIssues: status === 422 ? getValidationIssues(body) : [],
  });
}

export async function apiRequest<TResponse>(
  path: `/api/v1/${string}`,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const url = new URL(path, env.apiBaseUrl);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers({
    Accept: "application/json, application/geo+json",
  });

  if (options.auth === "required" && !options.session) {
    throw new ApiError("Se requiere una sesión válida para continuar.", {
      status: 401,
      code: "SESION_REQUERIDA",
    });
  }

  let body: string | undefined;

  if (options.body !== undefined) {
    try {
      body = JSON.stringify(options.body);
      if (body === undefined) throw new Error("JSON no serializable");
    } catch {
      throw new ApiError("Los datos de la solicitud no se pueden enviar como JSON.", {
        status: 0,
        code: "SOLICITUD_INVALIDA",
      });
    }

    headers.set("Content-Type", "application/json");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new ApiError("El tiempo máximo de la solicitud debe ser válido.", {
      status: 0,
      code: "SOLICITUD_INVALIDA",
    });
  }

  const controller = new AbortController();
  let abortReason: "timeout" | "cancelled" | undefined;
  const cancel = () => {
    if (!controller.signal.aborted) {
      abortReason = "cancelled";
      controller.abort();
    }
  };
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      abortReason = "timeout";
      controller.abort();
    }
  }, timeoutMs);

  const signals = [options.signal, options.session?.signal];
  for (const signal of signals) {
    if (signal?.aborted) {
      cancel();
    } else {
      signal?.addEventListener("abort", cancel, { once: true });
    }
  }

  try {
    const response = await transport(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    }, options.session);
    controller.signal.throwIfAborted();

    if (!response.ok) {
      let errorBody: unknown;

      try {
        errorBody = await response.json();
      } catch {
        controller.signal.throwIfAborted();
      }

      throw createHttpError(response.status, errorBody);
    }

    try {
      const data: TResponse = await response.json();
      controller.signal.throwIfAborted();
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ApiError("El servicio devolvió una respuesta JSON inválida.", {
          status: response.status,
          code: "RESPUESTA_INVALIDA",
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof TransportSessionError) {
      throw new ApiError(error.message, {
        status: 401,
        code: error.code,
      });
    }

    if (abortReason) {
      throw new ApiError(
        abortReason === "timeout"
          ? "El servicio tardó demasiado en responder. Intenta nuevamente."
          : "La solicitud fue cancelada.",
        {
          status: 0,
          code:
            abortReason === "timeout" ? "TIEMPO_AGOTADO" : "SOLICITUD_CANCELADA",
        },
      );
    }

    throw new ApiError("No fue posible conectar con el servicio.", {
      status: 0,
      code: "ERROR_RED",
    });
  } finally {
    clearTimeout(timer);
    for (const signal of signals) signal?.removeEventListener("abort", cancel);
  }
}
