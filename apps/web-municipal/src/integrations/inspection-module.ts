import { toPublicRiskPoints } from "../components/Map/public-points";
import { env } from "../config/env";
import { publicMapConfig } from "../config/map";
import type { AuthenticatedRequestOptions } from "../services/api";
import { getInspectionFactors } from "../services/factores";
import { getFichasPunto } from "../services/inspections";
import { getPointDetail } from "../services/puntos";
import { getRiskPoints } from "../services/riesgo";
import { queryKey, readCachedQuery } from "../services/query-cache";

export { FormFicha, type FormFichaProps } from "../components/FichaTerreno/FormFicha";
export { HistorialFichas } from "../components/FichaTerreno/HistorialFichas";

export type InspectionPoint = { id: number; name: string; count: number | null };
export type InspectionChoice = Pick<InspectionPoint, "id" | "name"> & { count?: number | null };

export async function getInspectionPoint(id: number, options: AuthenticatedRequestOptions): Promise<InspectionPoint> {
  return readCachedQuery(queryKey("inspection-context", { id }), options, async (signal) => {
    if (env.apiMode === "mock") {
      const { demoInspectionPoints } = await import("../mocks/inspection-fixtures");
      const point = demoInspectionPoints.find((item) => item.id === id);
      if (point) {
        const history = await getFichasPunto(id, { ...options, signal });
        return { ...point, count: history.length };
      }
    }
    const detail = await getPointDetail(id, { ...options, signal });
    return { id, name: detail.nombre_interseccion ?? `Punto #${id} · Nombre no informado`, count: detail.total_fichas_inspeccion };
  });
}

async function getInspectionChoices(options: AuthenticatedRequestOptions): Promise<InspectionChoice[]> {
  const points = toPublicRiskPoints(await getRiskPoints({ comuna: publicMapConfig.comuna }, options));
  const choices: InspectionChoice[] = points.map((point) => ({ id: point.id_punto, name: point.nombre_interseccion }));
  if (env.apiMode === "mock") {
    const { demoInspectionPoints } = await import("../mocks/inspection-fixtures");
    return [...demoInspectionPoints, ...choices.filter((point) => !demoInspectionPoints.some((demo) => demo.id === point.id))];
  }
  return choices;
}

export async function loadInspectionCatalog(options: AuthenticatedRequestOptions) {
  return readCachedQuery(queryKey("inspection-catalog"), options, async (signal) => {
    const [choices, factors] = await Promise.all([getInspectionChoices({ ...options, signal }), getInspectionFactors({ ...options, signal })]);
    return { choices, factors };
  });
}
