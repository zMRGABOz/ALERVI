import { isRiskLevel } from "../config/risk-levels";
import type { components, operations } from "../types/api.generated";
import { ApiError } from "./api";

type RankingResponse = components["schemas"]["RankingResponse"];
type RankingQuery = NonNullable<operations["getRanking"]["parameters"]["query"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function normalizeComuna(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function invalidRanking(): never {
  throw new ApiError("El servicio devolvió un ranking no válido. Intenta nuevamente.", {
    status: 200,
    code: "RANKING_INVALIDO",
  });
}

export function assertRankingResponse(value: unknown, query: RankingQuery): asserts value is RankingResponse {
  if (
    !isRecord(value) || !isCount(value.total_puntos) ||
    !isText(value.comuna) || !isText(value.periodo) || !isText(value.configuracion_version) ||
    !isText(value.fecha_calculo) || !Number.isFinite(Date.parse(value.fecha_calculo)) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.fecha_calculo) ||
    !Array.isArray(value.puntos) || !Array.isArray(value.puntos_sin_indice) ||
    (query.comuna !== undefined && normalizeComuna(value.comuna) !== normalizeComuna(query.comuna)) ||
    (query.limit !== undefined && value.puntos.length > query.limit)
  ) return invalidRanking();

  const comuna = normalizeComuna(value.comuna);
  const ids = new Set<number>();

  function checkPoint(point: unknown): asserts point is Record<string, unknown> {
    if (
      !isRecord(point) || !isCount(point.id_punto) || point.id_punto < 1 || ids.has(point.id_punto) ||
      !isText(point.nombre_interseccion) || !isText(point.comuna) ||
      normalizeComuna(point.comuna) !== comuna ||
      typeof point.latitud !== "number" || !Number.isFinite(point.latitud) || Math.abs(point.latitud) > 90 ||
      typeof point.longitud !== "number" || !Number.isFinite(point.longitud) || Math.abs(point.longitud) > 180
    ) return invalidRanking();
    ids.add(point.id_punto);
  }

  for (const point of value.puntos) {
    checkPoint(point);
    if (
      !isCount(point.posicion_ranking) || point.posicion_ranking < 1 ||
      !isRiskLevel(point.nivel_riesgo) || !isScore(point.indice_prioridad) ||
      !isScore(point.severidad_s) || !isScore(point.frecuencia_f) ||
      !isScore(point.tendencia_t) || !isScore(point.contexto_c) ||
      !isCount(point.total_siniestros) || !isCount(point.total_fallecidos) || !isCount(point.total_graves) ||
      point.estado_indice !== "CALCULADO"
    ) return invalidRanking();
  }

  for (const point of value.puntos_sin_indice) {
    checkPoint(point);
    if (!isText(point.motivo) || point.estado_indice !== "SIN_INDICE_DISPONIBLE") return invalidRanking();
  }
  // Validar la respuesta no cambia su orden, posiciones, empates ni valores de IP.
}
