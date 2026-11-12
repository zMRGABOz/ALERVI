import { publicMapConfig } from "../../config/map";
import { isRiskLevel } from "../../config/risk-levels";
import { ApiError } from "../../services/api";
import type { components } from "../../types/api.generated";

type PublicProperties = components["schemas"]["PuntoCriticoProperties"];

export type PublicRiskPoint = Pick<
  PublicProperties,
  | "id_punto" | "nombre_interseccion" | "comuna" | "nivel_riesgo"
  | "indice_prioridad" | "total_siniestros" | "total_fallecidos"
  | "total_graves" | "resumen_publico"
> & { position: [number, number] };

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

export function formatRiskIndex(value: number): string {
  return indexFormatter.format(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizeComuna(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function invalidLayer(): never {
  throw new ApiError("El servicio devolvió una capa pública no válida. Intenta nuevamente.", {
    status: 200,
    code: "CAPA_PUBLICA_INVALIDA",
  });
}

export function toPublicRiskPoints(value: unknown): PublicRiskPoint[] {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return invalidLayer();
  }

  const seen = new Set<number>();
  return value.features.map((feature: unknown): PublicRiskPoint => {
    if (
      !isRecord(feature) || feature.type !== "Feature" ||
      !isRecord(feature.geometry) || feature.geometry.type !== "Point" ||
      !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2 ||
      !isRecord(feature.properties)
    ) return invalidLayer();

    const [longitude, latitude] = feature.geometry.coordinates;
    const properties = feature.properties;
    if (
      typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !isCount(properties.id_punto) || seen.has(properties.id_punto) ||
      typeof properties.nombre_interseccion !== "string" || !properties.nombre_interseccion.trim() ||
      typeof properties.comuna !== "string" ||
      normalizeComuna(properties.comuna) !== normalizeComuna(publicMapConfig.comuna) ||
      !isRiskLevel(properties.nivel_riesgo) ||
      typeof properties.indice_prioridad !== "number" || !Number.isFinite(properties.indice_prioridad) ||
      properties.indice_prioridad < 0 || properties.indice_prioridad > 100 ||
      !isCount(properties.total_siniestros) ||
      (properties.total_fallecidos !== undefined && !isCount(properties.total_fallecidos)) ||
      (properties.total_graves !== undefined && !isCount(properties.total_graves))
    ) return invalidLayer();

    seen.add(properties.id_punto);
    // Solo campos públicos conocidos; no trasladar objetos del servicio al popup.
    return {
      id_punto: properties.id_punto,
      nombre_interseccion: properties.nombre_interseccion,
      comuna: properties.comuna,
      nivel_riesgo: properties.nivel_riesgo,
      indice_prioridad: properties.indice_prioridad,
      total_siniestros: properties.total_siniestros,
      total_fallecidos: properties.total_fallecidos,
      total_graves: properties.total_graves,
      resumen_publico: typeof properties.resumen_publico === "string" ? properties.resumen_publico : undefined,
      position: [latitude, longitude],
    };
  });
}
