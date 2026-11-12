import type { RankingQuery } from "../services/ranking";
import { rankingDataCoverage, type DataCoverage } from "./data-coverage";
import { initialRankingQuery } from "./ranking";

// El contrato no declara un máximo; el servicio aplica limit en la consulta.
export const rankingTopOptions = [10, 20, 50] as const;
type TopLimit = (typeof rankingTopOptions)[number];
export type RankingFilterField = "mode" | "year" | "startYear" | "endYear" | "limit";
export type RankingFilterFields = Record<RankingFilterField, string>;
export type RankingFieldErrors = Partial<Record<RankingFilterField, string>>;
export type RankingFiltersValue = { limit: TopLimit } & (
  | { mode: "anio"; year: number }
  | { mode: "rango"; startYear: number; endYear: number }
);

const FILTER_PARAMS = ["anio", "periodo_inicio", "periodo_fin", "limit", "offset", "comuna"] as const;

export function defaultRankingFilterFields(): RankingFilterFields {
  return {
    mode: "rango",
    year: String(rankingDataCoverage.endYear),
    startYear: String(rankingDataCoverage.startYear),
    endYear: String(rankingDataCoverage.endYear),
    limit: String(initialRankingQuery.limit),
  };
}

export function validateRankingFilterFields(fields: RankingFilterFields, coverage: DataCoverage = rankingDataCoverage) {
  const errors: RankingFieldErrors = {};
  const limit = rankingTopOptions.find((value) => String(value) === fields.limit);
  if (!limit) errors.limit = "Selecciona Top 10, Top 20 o Top 50.";

  function year(field: "year" | "startYear" | "endYear"): number | null {
    const raw = fields[field];
    if (!/^\d{4}$/.test(raw)) {
      errors[field] = "Selecciona un año entero válido.";
      return null;
    }
    const value = Number(raw);
    if (value < coverage.startYear || value > coverage.endYear) {
      errors[field] = coverage.status === "confirmada"
        ? `La demostración tiene cobertura sintética entre ${coverage.startYear} y ${coverage.endYear}.`
        : `Selecciona un año de referencia entre ${coverage.startYear} y ${coverage.endYear}; su cobertura está pendiente de confirmación.`;
      return null;
    }
    return value;
  }

  let value: RankingFiltersValue | null = null;
  if (fields.mode === "anio") {
    const selectedYear = year("year");
    if (selectedYear !== null && limit) value = { mode: "anio", year: selectedYear, limit };
  } else if (fields.mode === "rango") {
    const startYear = year("startYear");
    const endYear = year("endYear");
    if (startYear !== null && endYear !== null) {
      if (startYear > endYear) errors.endYear = "El año final debe ser igual o posterior al inicial.";
      else if (limit) value = { mode: "rango", startYear, endYear, limit };
    }
  } else {
    errors.mode = "Selecciona año individual o intervalo de años.";
  }
  return { value, errors };
}

function toRankingQuery(filters: RankingFiltersValue, offset = 0): RankingQuery {
  return {
    comuna: initialRankingQuery.comuna,
    limit: filters.limit,
    offset,
    ...(filters.mode === "anio"
      ? { anio: filters.year }
      : { periodo_inicio: filters.startYear, periodo_fin: filters.endYear }),
  };
}

export function parseRankingSearch(search: URLSearchParams) {
  const defaults = defaultRankingFilterFields();
  const hasYear = search.has("anio");
  const hasRange = search.has("periodo_inicio") || search.has("periodo_fin");
  const fields: RankingFilterFields = {
    ...defaults,
    mode: hasYear ? "anio" : "rango",
    year: search.get("anio") ?? defaults.year,
    startYear: hasRange ? search.get("periodo_inicio") ?? "" : defaults.startYear,
    endYear: hasRange ? search.get("periodo_fin") ?? "" : defaults.endYear,
    limit: search.get("limit") ?? defaults.limit,
  };
  const validation = validateRankingFilterFields(fields);
  const errors = Object.values(validation.errors);
  for (const name of FILTER_PARAMS) {
    if (search.getAll(name).length > 1) errors.push(`El parámetro ${name} aparece más de una vez.`);
  }
  if (hasYear && hasRange) errors.push("Usa un año individual o un intervalo, sin combinar ambos en la URL.");
  if (search.has("comuna")) {
    const comuna = search.get("comuna")?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (comuna !== "concepcion") errors.push("Esta vista consulta únicamente la comuna de Concepción.");
  }
  const offset = search.get("offset") ?? "0";
  if (!/^(0|[1-9]\d*)$/.test(offset) || !Number.isSafeInteger(Number(offset))) {
    errors.push("El desplazamiento debe ser un entero mayor o igual a cero.");
  }
  return {
    fields,
    errors,
    query: validation.value && !errors.length ? toRankingQuery(validation.value, Number(offset)) : null,
  };
}

export function rankingFilterSearch(current: URLSearchParams, filters: RankingFiltersValue | null): string {
  const next = new URLSearchParams(current);
  for (const name of FILTER_PARAMS) next.delete(name);
  if (filters) {
    if (filters.mode === "anio") next.set("anio", String(filters.year));
    else {
      next.set("periodo_inicio", String(filters.startYear));
      next.set("periodo_fin", String(filters.endYear));
    }
    next.set("limit", String(filters.limit));
    // Cada cambio inicia una consulta nueva desde la primera posición.
    next.set("offset", "0");
  }
  return next.toString();
}
