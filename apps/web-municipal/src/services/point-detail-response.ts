import { isRiskLevel } from "../config/risk-levels";
import type { components } from "../types/api.generated";
import { ApiError } from "./api";

type Schema = components["schemas"];
type NullableFields<T> = { [K in keyof T]-?: T[K] | null };
export type ScoringData = NullableFields<Schema["DesgloseFactoresScoring"]>;
export type AnnualRecord = Pick<Schema["HistoricoSiniestrosAnual"], "anio"> & NullableFields<Omit<Schema["HistoricoSiniestrosAnual"], "anio">>;
export type UrbanElement = NullableFields<NonNullable<Schema["ElementoUrbanoCercano"]>>;
export type UrbanData = NullableFields<Pick<Schema["EntornoUrbanoContexto"], "buffer_metros" | "total_colegios_buffer" | "total_paraderos_buffer">> & {
  colegio_mas_cercano: UrbanElement | null;
  paradero_mas_cercano: UrbanElement | null;
};
type DetailDto = Schema["PuntoCriticoTecnicoDetail"];
type DetailIdentity = "id_punto" | "nombre_interseccion" | "comuna";
type DetailSections = "desglose_scoring" | "historico_anual" | "entorno_urbano";

// Modelo de presentación derivado del DTO: los campos ausentes o no válidos
// quedan explícitamente en null, sin completar antecedentes con ceros.
export type PointDetail = Pick<DetailDto, DetailIdentity> & NullableFields<Omit<DetailDto, DetailIdentity | DetailSections>> & {
  desglose_scoring: ScoringData | null;
  historico_anual: AnnualRecord[] | null;
  entorno_urbano: UrbanData | null;
  partial: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizePointDetail(value: unknown, id: number): PointDetail {
  if (
    !isRecord(value) || value.id_punto !== id ||
    !isText(value.nombre_interseccion) || !isText(value.comuna) ||
    value.comuna.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() !== "concepcion"
  ) {
    throw new ApiError("El servicio devolvió un detalle no válido para el punto y la comuna solicitados.", { status: 200, code: "DETALLE_INVALIDO" });
  }

  let partial = false;
  function number(raw: unknown, min = 0, max = Number.MAX_VALUE, integer = false): number | null {
    if (isNumber(raw) && raw >= min && raw <= max && (!integer || Number.isSafeInteger(raw))) return raw;
    partial = true;
    return null;
  }
  function text(raw: unknown): string | null {
    if (isText(raw)) return raw;
    partial = true;
    return null;
  }
  function scoring(raw: unknown): ScoringData | null {
    if (!isRecord(raw)) { partial = true; return null; }
    return {
      formula: text(raw.formula),
      w_severidad: number(raw.w_severidad, 0, 1),
      severidad_s: number(raw.severidad_s, 0, 100),
      aporte_severidad: number(raw.aporte_severidad, 0, 100),
      w_frecuencia: number(raw.w_frecuencia, 0, 1),
      frecuencia_f: number(raw.frecuencia_f, 0, 100),
      aporte_frecuencia: number(raw.aporte_frecuencia, 0, 100),
      w_tendencia: number(raw.w_tendencia, 0, 1),
      tendencia_t: number(raw.tendencia_t, 0, 100),
      aporte_tendencia: number(raw.aporte_tendencia, 0, 100),
      w_contexto: number(raw.w_contexto, 0, 1),
      contexto_c: number(raw.contexto_c, 0, 100),
      aporte_contexto: number(raw.aporte_contexto, 0, 100),
    };
  }
  function history(raw: unknown): AnnualRecord[] | null {
    if (!Array.isArray(raw)) { partial = true; return null; }
    const years = new Set<number>();
    const rows: AnnualRecord[] = [];
    for (const row of raw) {
      if (!isRecord(row) || !Number.isSafeInteger(row.anio) || typeof row.anio !== "number" || row.anio < 1000 || row.anio > 9999 || years.has(row.anio)) {
        partial = true;
        return null;
      }
      years.add(row.anio);
      rows.push({
        anio: row.anio,
        cantidad_siniestros: number(row.cantidad_siniestros, 0, Number.MAX_SAFE_INTEGER, true),
        fallecidos: number(row.fallecidos, 0, Number.MAX_SAFE_INTEGER, true),
        graves: number(row.graves, 0, Number.MAX_SAFE_INTEGER, true),
        menos_graves: number(row.menos_graves, 0, Number.MAX_SAFE_INTEGER, true),
        leves: number(row.leves, 0, Number.MAX_SAFE_INTEGER, true),
      });
    }
    return rows.sort((a, b) => a.anio - b.anio);
  }
  function element(raw: unknown, category: "colegio" | "paradero"): UrbanElement | null {
    // El contrato permite ausencia/null para los elementos más cercanos.
    if (raw === undefined || raw === null) return null;
    if (!isRecord(raw) || raw.categoria !== category) { partial = true; return null; }
    return {
      id_elemento: number(raw.id_elemento, 1, Number.MAX_SAFE_INTEGER, true),
      categoria: category,
      nombre: text(raw.nombre),
      distancia_m: number(raw.distancia_m),
    };
  }
  function urban(raw: unknown): UrbanData | null {
    if (!isRecord(raw)) { partial = true; return null; }
    return {
      buffer_metros: number(raw.buffer_metros, 0, Number.MAX_SAFE_INTEGER, true),
      total_colegios_buffer: number(raw.total_colegios_buffer, 0, Number.MAX_SAFE_INTEGER, true),
      total_paraderos_buffer: number(raw.total_paraderos_buffer, 0, Number.MAX_SAFE_INTEGER, true),
      colegio_mas_cercano: element(raw.colegio_mas_cercano, "colegio"),
      paradero_mas_cercano: element(raw.paradero_mas_cercano, "paradero"),
    };
  }

  const level = isRiskLevel(value.nivel_riesgo) ? value.nivel_riesgo : null;
  if (level === null) partial = true;
  const detail = {
    id_punto: id,
    nombre_interseccion: value.nombre_interseccion,
    comuna: value.comuna,
    latitud: number(value.latitud, -90, 90),
    longitud: number(value.longitud, -180, 180),
    nivel_riesgo: level,
    indice_prioridad: number(value.indice_prioridad, 0, 100),
    estado_indice: text(value.estado_indice),
    configuracion_pesos_version: text(value.configuracion_pesos_version),
    desglose_scoring: scoring(value.desglose_scoring),
    historico_anual: history(value.historico_anual),
    entorno_urbano: urban(value.entorno_urbano),
    total_fichas_inspeccion: number(value.total_fichas_inspeccion, 0, Number.MAX_SAFE_INTEGER, true),
    explicacion_tecnica: text(value.explicacion_tecnica),
    advertencia_legal: text(value.advertencia_legal),
  };
  return { ...detail, partial };
}

export const scoringFactors = [
  { label: "Severidad", symbol: "S", value: "severidad_s", weight: "w_severidad", contribution: "aporte_severidad" },
  { label: "Frecuencia", symbol: "F", value: "frecuencia_f", weight: "w_frecuencia", contribution: "aporte_frecuencia" },
  { label: "Tendencia", symbol: "T", value: "tendencia_t", weight: "w_tendencia", contribution: "aporte_tendencia" },
  { label: "Contexto", symbol: "C", value: "contexto_c", weight: "w_contexto", contribution: "aporte_contexto" },
] as const;

export function scoringIssues(detail: PointDetail): string[] {
  const scoring = detail.desglose_scoring;
  if (!scoring || detail.estado_indice === "SIN_INDICE_DISPONIBLE") return [];
  const issues: string[] = [];
  const weights = scoringFactors.map((factor) => scoring[factor.weight]);
  const contributions = scoringFactors.map((factor) => scoring[factor.contribution]);
  if (weights.every((weight): weight is number => weight !== null) && Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 0.0001) {
    issues.push("Los pesos informados no suman 1.");
  }
  for (const factor of scoringFactors) {
    const value = scoring[factor.value], weight = scoring[factor.weight], contribution = scoring[factor.contribution];
    if (value !== null && weight !== null && contribution !== null && Math.abs(value * weight - contribution) > 0.1) {
      issues.push(`El aporte informado de ${factor.label.toLowerCase()} no coincide con su valor y peso.`);
    }
  }
  if (detail.indice_prioridad !== null && contributions.every((value): value is number => value !== null) && Math.abs(contributions.reduce((sum, value) => sum + value, 0) - detail.indice_prioridad) > 0.1) {
    issues.push("La suma de los aportes informados no coincide con el IP recibido.");
  }
  // Solo diagnóstico: se conservan el IP, los pesos y los aportes recibidos.
  return issues;
}
