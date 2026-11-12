import type { operations } from "../types/api.generated";
import { ApiError, apiRequest, type AuthenticatedRequestOptions } from "./api";
import { normalizePointDetail, type PointDetail } from "./point-detail-response";

type PointId =
  operations["getDetallePuntoTecnico"]["parameters"]["path"]["id_punto"];
export type { PointDetail } from "./point-detail-response";

export async function getPointDetail(
  idPunto: PointId,
  options: AuthenticatedRequestOptions,
): Promise<PointDetail> {
  if (!Number.isSafeInteger(idPunto) || idPunto < 1) {
    throw new ApiError("El identificador del punto debe ser un entero positivo válido.", { status: 400, code: "PUNTO_ID_INVALIDO" });
  }
  const response = await apiRequest<unknown>(
    `/api/v1/puntos/${encodeURIComponent(String(idPunto))}`,
    {
      auth: "required",
      session: options.session,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
  return normalizePointDetail(response, idPunto);
}
