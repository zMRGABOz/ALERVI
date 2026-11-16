"use client";

import { useCallback } from "react";
import { ApiError } from "../services/api";
import { getPointDetail } from "../services/puntos";
import { queryKey } from "../services/query-cache";
import { useCachedQuery } from "./useCachedQuery";
import { useSession } from "./useSession";

const NO_SESSION = new ApiError("Se requiere una sesión municipal válida.", { status: 401, code: "SESION_REQUERIDA" });

export function usePointDetail(id: number | null) {
  const { session } = useSession();
  const load = useCallback(() => session && id !== null ? getPointDetail(id, { session }) : Promise.reject(NO_SESSION), [id, session]);
  const state = useCachedQuery(id !== null && session ? queryKey("point-detail", { id }) : null, load, session ?? undefined);
  if (id === null) return { ...state, status: "invalid-id" as const, data: null, error: null };
  if (!session) return { ...state, status: "unauthenticated" as const, data: null, error: NO_SESSION };
  if (state.status === "error") {
    const status = state.error.status === 401 ? "unauthenticated" : state.error.status === 403 ? "forbidden" : state.error.code === "SIN_INDICE_DISPONIBLE" ? "unscored" : state.error.status === 404 ? "not-found" : "error";
    return { ...state, status } as const;
  }
  return state;
}
