import { canUseDemoSession } from "../config/demo-session";
import type { components } from "../types/api.generated";
import { isSessionRole, type Session } from "../types/session";
import type { ApiTransport } from "../services/transport";
import {
  DEMO_DATA,
  demoDetails,
  demoRisk,
  demoUnscoredPoint,
  demoWeights,
  rankingFixture,
} from "./fixtures";

type Schema = components["schemas"];

export type MockScenario =
  | "normal"
  | "empty"
  | "unauthenticated"
  | "forbidden"
  | "unavailable"
  | "slow";

type MockTransportOptions = {
  scenario?: MockScenario;
  delayMs?: number;
};

class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function errorResponse(status: number, code: string, message: string): Response {
  const body: Schema["ErrorResponse"] = { codigo: code, mensaje: message };
  return Response.json(body, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonBody(options: RequestInit): unknown {
  try {
    if (typeof options.body !== "string") throw new Error("Sin JSON");
    return JSON.parse(options.body);
  } catch {
    throw new MockHttpError(400, "JSON_INVALIDO", "Envía un cuerpo JSON válido.");
  }
}

async function wait(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();

  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function integer(query: URLSearchParams, name: string, fallback: number): number {
  const raw = query.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new MockHttpError(
      400, "FILTRO_INVALIDO", `El parámetro ${name} debe ser un entero válido.`,
    );
  }
  return Number(raw);
}

function period(query: URLSearchParams): [number, number] {
  if (
    query.has("anio") &&
    (query.has("periodo_inicio") || query.has("periodo_fin"))
  ) {
    throw new MockHttpError(
      400, "PERIODO_INVALIDO", "Selecciona un año o un intervalo, sin combinarlos.",
    );
  }

  const start = query.has("anio")
    ? integer(query, "anio", DEMO_DATA.startYear)
    : integer(query, "periodo_inicio", DEMO_DATA.startYear);
  const end = query.has("anio")
    ? start
    : integer(query, "periodo_fin", DEMO_DATA.endYear);

  if (start > end) {
    throw new MockHttpError(
      400, "PERIODO_INVALIDO", "El inicio del período no puede ser posterior al término.",
    );
  }
  if (start < DEMO_DATA.startYear || end > DEMO_DATA.endYear) {
    throw new MockHttpError(
      400, "PERIODO_SIN_COBERTURA", "La demostración solo tiene cobertura sintética entre 2020 y 2025.",
    );
  }
  return [start, end];
}

function matchesComuna(query: URLSearchParams): boolean {
  const name = query.get("comuna") ?? DEMO_DATA.comuna;
  return (
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() ===
    "concepcion"
  );
}

function riskFixture(
  query: URLSearchParams,
  empty: boolean,
): Schema["GeoJsonFeatureCollection"] {
  let bounds: number[] | undefined;
  if (query.has("bbox")) {
    const parts = query.get("bbox")?.split(",") ?? [];
    bounds = parts.map(Number);
    if (
      parts.length !== 4 || parts.some((part) => !part.trim()) ||
      bounds.some((value) => !Number.isFinite(value)) ||
      bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90 ||
      bounds[0] > bounds[2] || bounds[1] > bounds[3]
    ) {
      throw new MockHttpError(
        400, "BBOX_INVALIDO", "El bbox debe contener minLon,minLat,maxLon,maxLat válidos.",
      );
    }
  }
  return {
    type: "FeatureCollection",
    features: empty || !matchesComuna(query) ? [] : demoRisk.features.filter((feature) => {
      if (!bounds) return true;
      const [lon, lat] = feature.geometry.coordinates;
      return (
        lon >= bounds[0] && lon <= bounds[2] &&
        lat >= bounds[1] && lat <= bounds[3]
      );
    }),
  };
}

function weightsBody(value: unknown): Schema["PonderacionesUpdateRequest"] {
  if (!isRecord(value)) {
    throw new MockHttpError(
      400, "PESOS_INVALIDOS", "Envía los cuatro pesos como fracciones entre 0 y 1.",
    );
  }
  const { w_severidad, w_frecuencia, w_tendencia, w_contexto, descripcion_cambio } = value;
  if (
    typeof w_severidad !== "number" || typeof w_frecuencia !== "number" ||
    typeof w_tendencia !== "number" || typeof w_contexto !== "number" ||
    [w_severidad, w_frecuencia, w_tendencia, w_contexto].some(
      (weight) => !Number.isFinite(weight) || weight < 0 || weight > 1,
    ) ||
    Math.abs(w_severidad + w_frecuencia + w_tendencia + w_contexto - 1) > 1e-6 ||
    (descripcion_cambio !== undefined && typeof descripcion_cambio !== "string")
  ) {
    throw new MockHttpError(
      400, "PESOS_INVALIDOS", "Los cuatro pesos deben estar entre 0 y 1 y sumar 1.",
    );
  }
  return { w_severidad, w_frecuencia, w_tendencia, w_contexto, descripcion_cambio };
}

// Cada instancia conserva pesos solo en memoria. El perfil llega como contexto
// local, nunca como Authorization ni mediante un inicio de sesión ficticio.
// Escenarios inyectables sin añadir parámetros al contrato HTTP de servicios.
export function createMockTransport({
  scenario = "normal",
  delayMs = scenario === "slow" ? 20_000 : 150,
}: MockTransportOptions = {}): ApiTransport {
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 2_147_483_647) {
    throw new RangeError("La latencia de demostración debe ser un entero válido.");
  }
  let weightsVersion = 1;
  let weights = structuredClone(demoWeights);

  function authenticate(session?: Session): Schema["UsuarioResponse"] {
    if (
      scenario === "unauthenticated" || !canUseDemoSession() ||
      session?.source !== "demo" || session.accessToken !== null ||
      !session.usuario.activo || !isSessionRole(session.rol) ||
      session.rol !== session.usuario.rol
    ) {
      throw new MockHttpError(
        401, "SESION_REQUERIDA", "Se requiere un perfil de demostración local válido.",
      );
    }
    session.signal.throwIfAborted();
    if (scenario === "forbidden") {
      throw new MockHttpError(
        403, "PERMISO_DENEGADO", "La demostración simula una respuesta sin permiso.",
      );
    }
    return session.usuario;
  }

  return async (url, options, session) => {
    await wait(delayMs, options.signal);
    try {
      if (scenario === "unavailable") {
        throw new MockHttpError(
          503, "SERVICIO_NO_DISPONIBLE", "El servicio de demostración no está disponible.",
        );
      }
      const method = options.method ?? "GET";
      const path = url.pathname;
      if (path === "/api/v1/publico/riesgo" && method === "GET") {
        return Response.json(riskFixture(url.searchParams, scenario === "empty"), {
          headers: { "Content-Type": "application/geo+json" },
        });
      }

      const detailMatch = /^\/api\/v1\/puntos\/(\d+)$/.exec(path);
      const isRanking = path === "/api/v1/ranking" && method === "GET";
      const isDetail = detailMatch !== null && method === "GET";
      const isWeights = path === "/api/v1/factores/ponderaciones" &&
        (method === "GET" || method === "PUT");
      if (!isRanking && !isDetail && !isWeights) {
        throw new MockHttpError(
          404, "RUTA_NO_DISPONIBLE", "Esta operación no está disponible en la demostración.",
        );
      }
      const user = authenticate(session);

      if (isRanking) {
        const [start, end] = period(url.searchParams);
        const limit = integer(url.searchParams, "limit", 10);
        const offset = integer(url.searchParams, "offset", 0);
        if (limit < 1 || limit > 100) {
          throw new MockHttpError(
            400, "LIMITE_INVALIDO", "La demostración admite entre 1 y 100 resultados por página.",
          );
        }
        const result = rankingFixture(start, end);
        if (scenario === "empty" || !matchesComuna(url.searchParams)) {
          result.total_puntos = 0;
          result.puntos = [];
          result.puntos_sin_indice = [];
        } else {
          result.puntos = result.puntos.slice(offset, offset + limit);
        }
        return Response.json(result);
      }

      if (isDetail && detailMatch) {
        const id = Number(detailMatch[1]);
        if (id === demoUnscoredPoint.id_punto && scenario !== "empty") {
          throw new MockHttpError(
            404, "SIN_INDICE_DISPONIBLE", "El punto de demostración no tiene un detalle calculado: la serie es insuficiente.",
          );
        }
        const point = scenario === "empty"
          ? undefined
          : demoDetails.find((item) => item.id_punto === id);
        if (!point) {
          throw new MockHttpError(
            404, "PUNTO_NO_ENCONTRADO", "El punto no está disponible en la demostración.",
          );
        }
        return Response.json(point);
      }

      if (method === "PUT") {
        if (user.rol !== "administrador") {
          throw new MockHttpError(
            403, "PERMISO_DENEGADO", "Solo el Administrador puede modificar las ponderaciones.",
          );
        }
        const update = weightsBody(jsonBody(options));
        weights = {
          ...weights,
          ...update,
          version: `demo-v${++weightsVersion}`,
          suma_pesos: update.w_severidad + update.w_frecuencia +
            update.w_tendencia + update.w_contexto,
          fecha_calibracion: new Date(
            Date.parse(DEMO_DATA.calculatedAt) + (weightsVersion - 1) * 1000,
          ).toISOString(),
          descripcion_cambio: `${update.descripcion_cambio ?? "Cambio de demostración"} · Solo en memoria; recálculo no simulado.`,
          modificado_por: user.correo,
        };
      }
      return Response.json(weights);
    } catch (error) {
      if (error instanceof MockHttpError) {
        return errorResponse(error.status, error.code, error.message);
      }
      throw error;
    }
  };
}

export const mockTransport = createMockTransport();
