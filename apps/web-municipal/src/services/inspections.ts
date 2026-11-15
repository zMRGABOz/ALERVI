import { env } from "../config/env";
import type {
  ActualizarFichaPayload,
  FichaInspeccion,
  FotografiaFicha,
  NuevaFichaPayload,
} from "../components/FichaTerreno/types";
import { apiRequest, type AuthenticatedRequestOptions } from "./api";
import { transport } from "./transport";

export function getFichasPunto(
  idPunto: number,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion[]> {
  return apiRequest<FichaInspeccion[]>(
    `/api/v1/puntos/${encodeURIComponent(String(idPunto))}/fichas`,
    {
      auth: "required",
      session: options.session,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
}

export function createFicha(
  payload: NuevaFichaPayload,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion> {
  return apiRequest<FichaInspeccion>("/api/v1/inspections", {
    method: "POST",
    body: payload,
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}

export function updateFicha(
  idFicha: number,
  payload: ActualizarFichaPayload,
  options: AuthenticatedRequestOptions,
): Promise<FichaInspeccion> {
  return apiRequest<FichaInspeccion>(
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

  return response.json();
}
