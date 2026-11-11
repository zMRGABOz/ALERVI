import type { FeatureCollection, Point } from "geojson";
import type { MapPosition } from "../../config/map";
import type { RiskLevel } from "../../config/risk-levels";
import type { PublicRiskPoint } from "./public-points";

export type RiskColors = Readonly<Record<RiskLevel, string>>;
type MapPointProperties = Omit<PublicRiskPoint, "position"> & { marker_color: string };

export function toMapPosition([latitude, longitude]: PublicRiskPoint["position"]): MapPosition {
  return [longitude, latitude];
}

export function toMapLibrePoints(
  points: readonly PublicRiskPoint[],
  colors: RiskColors,
): FeatureCollection<Point, MapPointProperties> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      id: point.id_punto,
      geometry: { type: "Point", coordinates: toMapPosition(point.position) },
      properties: {
        id_punto: point.id_punto,
        nombre_interseccion: point.nombre_interseccion,
        comuna: point.comuna,
        nivel_riesgo: point.nivel_riesgo,
        indice_prioridad: point.indice_prioridad,
        total_siniestros: point.total_siniestros,
        total_fallecidos: point.total_fallecidos,
        total_graves: point.total_graves,
        resumen_publico: point.resumen_publico,
        marker_color: colors[point.nivel_riesgo],
      },
    })),
  };
}
