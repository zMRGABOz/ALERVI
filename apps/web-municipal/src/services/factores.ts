import type { FactorRiesgo } from "../components/FichaTerreno/types";
import { ApiError, apiRequest, type AuthenticatedRequestOptions } from "./api";
import { queryKey, readCachedQuery } from "./query-cache";

export async function getInspectionFactors(options: AuthenticatedRequestOptions): Promise<FactorRiesgo[]> {
  return readCachedQuery(queryKey("inspection-factors"), options, async (signal) => {
    const response = await apiRequest<unknown>("/api/v1/factores", {
      query: { solo_activos: true },
      auth: "required",
      ...options,
      signal,
    });
    if (!Array.isArray(response)) throw invalidFactors();
    const ids = new Set<number>();
    return response.map((value: unknown): FactorRiesgo => {
      if (typeof value !== "object" || value === null || !("id_factor" in value) || !("nombre" in value) || !("activo" in value)) throw invalidFactors();
      const { id_factor, nombre, activo } = value;
      if (typeof id_factor !== "number" || !Number.isSafeInteger(id_factor) || id_factor < 1 || ids.has(id_factor) || typeof nombre !== "string" || !nombre.trim() || typeof activo !== "boolean") throw invalidFactors();
      ids.add(id_factor);
      return { id_factor, nombre: nombre.trim(), activo, descripcion: "descripcion" in value && typeof value.descripcion === "string" ? value.descripcion : undefined };
    }).filter((factor) => factor.activo);
  });
}

function invalidFactors() {
  return new ApiError("El servicio devolvió un catálogo de factores no válido.", { status: 200, code: "RESPUESTA_INVALIDA" });
}
