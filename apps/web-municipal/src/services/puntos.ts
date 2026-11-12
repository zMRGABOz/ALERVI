import type { components, operations } from "../types/api.generated";
import { apiRequest, type AuthenticatedRequestOptions } from "./api";

type PointId =
  operations["getDetallePuntoTecnico"]["parameters"]["path"]["id_punto"];
export type PointDetail = components["schemas"]["PuntoCriticoTecnicoDetail"];

export function getPointDetail(
  idPunto: PointId,
  options: AuthenticatedRequestOptions,
): Promise<PointDetail> {
  return apiRequest<PointDetail>(
    `/api/v1/puntos/${encodeURIComponent(String(idPunto))}`,
    {
      auth: "required",
      session: options.session,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
}
