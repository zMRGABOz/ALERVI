import { env } from "../config/env";
import type {
  ActualizarFichaPayload,
  FichaInspeccion,
  FotografiaFicha,
  NuevaFichaPayload,
} from "../components/FichaTerreno/types";
import { ApiError, apiRequest, type AuthenticatedRequestOptions } from "./api";
import { transport } from "./transport";
import { invalidateInspectionQueries, queryKey, readCachedQuery } from "./query-cache";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export type InspectionPointSummary = { id_punto: number; total_fichas_inspeccion: number };
export type InspectionSummary = { total_fichas_inspeccion: number; puntos: InspectionPointSummary[] };

export async function getInspectionSummary(options: AuthenticatedRequestOptions): Promise<InspectionSummary> {
  return readCachedQuery(queryKey("inspection-summary"), options, async (signal) => {
    const value = await apiRequest<unknown>("/api/v1/inspections/resumen", {
      auth: "required",
      session: options.session,
      signal,
      timeoutMs: options.timeoutMs,
    });
    const ids = new Set<number>();
    let total = 0;
    if (!isRecord(value) || typeof value.total_fichas_inspeccion !== "number" ||
      !Number.isSafeInteger(value.total_fichas_inspeccion) || value.total_fichas_inspeccion < 0 ||
      !Array.isArray(value.puntos) || !value.puntos.every((point: unknown) => {
        if (!isRecord(point) || !isId(point.id_punto) || !isId(point.total_fichas_inspeccion) || ids.has(point.id_punto)) return false;
        ids.add(point.id_punto);
        total += point.total_fichas_inspeccion;
        return Number.isSafeInteger(total);
      }) || total !== value.total_fichas_inspeccion) {
      throw new ApiError("El servicio devolvió un total de inspecciones no válido. Intenta nuevamente.", {
        status: 200,
        code: "RESUMEN_INSPECCIONES_INVALIDO",
      });
    }
    const puntos: InspectionPointSummary[] = value.puntos.map((point: InspectionPointSummary) => ({
      id_punto: point.id_punto,
      total_fichas_inspeccion: point.total_fichas_inspeccion,
    }));
    puntos.sort((left, right) => right.total_fichas_inspeccion - left.total_fichas_inspeccion || left.id_punto - right.id_punto);
    return { total_fichas_inspeccion: value.total_fichas_inspeccion, puntos };
  });
}

function assertCreatedFicha(
  value: unknown,
  payload: NuevaFichaPayload,
  options: AuthenticatedRequestOptions,
): asserts value is FichaInspeccion {
  const expectedFactors = new Set(payload.factores_riesgo_ids);
  const receivedFactors = new Set<number>();
  if (
    !isRecord(value) || !isId(value.id_ficha) ||
    value.id_punto !== payload.id_punto ||
    value.id_inspector !== options.session.usuario.id_usuario ||
    value.fecha_visita !== payload.fecha_visita ||
    (payload.notas !== undefined && value.notas !== payload.notas) ||
    !Array.isArray(value.factores_riesgo) ||
    !value.factores_riesgo.every((factor: unknown) => {
      if (!isRecord(factor) || !isId(factor.id_factor) ||
        typeof factor.nombre !== "string" || !factor.nombre.trim() || typeof factor.activo !== "boolean" ||
        !expectedFactors.has(factor.id_factor) || receivedFactors.has(factor.id_factor)) return false;
      receivedFactors.add(factor.id_factor);
      return true;
    }) || receivedFactors.size !== expectedFactors.size ||
    !Array.isArray(value.fotografias) ||
    !value.fotografias.every((photo: unknown) => isRecord(photo) && isId(photo.id_foto) &&
      photo.id_ficha === value.id_ficha && typeof photo.ruta === "string" && !!photo.ruta.trim() &&
      typeof photo.url === "string" && !!photo.url.trim())
  ) {
    throw new ApiError("El servicio devolvió una ficha que no coincide con el punto, el Inspector o los datos enviados. El guardado no pudo confirmarse; consulta el historial antes de volver a enviarla.", {
      status: 201,
      code: "FICHA_RESPUESTA_INVALIDA",
    });
  }
}

export function getFichasPunto(
  idPunto: number,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion[]> {
  return readCachedQuery(queryKey("inspection-history", { id: idPunto }), options, (signal) => apiRequest<FichaInspeccion[]>(
    `/api/v1/puntos/${encodeURIComponent(String(idPunto))}/fichas`,
    {
      auth: "required",
      session: options.session,
      signal,
      timeoutMs: options.timeoutMs,
    },
  ));
}

export async function createFicha(
  payload: NuevaFichaPayload,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion> {
  const response = await apiRequest<unknown>("/api/v1/inspections", {
    method: "POST",
    body: payload,
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
  invalidateInspectionQueries(options.session, payload.id_punto);
  assertCreatedFicha(response, payload, options);
  return response;
}

export async function updateFicha(
  idFicha: number,
  payload: ActualizarFichaPayload,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion> {
  const response = await apiRequest<FichaInspeccion>(
    `/api/v1/inspections/${encodeURIComponent(String(idFicha))}`,
    {
      method: "PATCH",
      body: payload,
      auth: "required",
      session: options.session,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
  invalidateInspectionQueries(options.session, response.id_punto);
  return response;
}

export async function uploadFotoFicha(
  idFicha: number,
  foto: File,
  options: AuthenticatedRequestOptions,
): Promise<FotografiaFicha> {
  const formData = new FormData();
  formData.append("foto", foto);

  const url = new URL(
    `/api/v1/inspections/${encodeURIComponent(String(idFicha))}/fotos`,
    env.apiBaseUrl,
  );

  const response = await transport(
    url,
    {
      method: "POST",
      body: formData,
      signal: options.signal,
    },
    options.session,
  );

  if (!response.ok) {
    throw new Error(
      `No fue posible subir la fotografía "${foto.name}" (código ${response.status}).`,
    );
  }

  const photo: FotografiaFicha = await response.json();
  invalidateInspectionQueries(options.session);
  return photo;
}
