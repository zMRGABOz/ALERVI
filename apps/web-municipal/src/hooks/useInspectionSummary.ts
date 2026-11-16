"use client";

import { useCallback } from "react";
import { ApiError } from "../services/api";
import { getInspectionSummary } from "../services/inspections";
import { queryKey } from "../services/query-cache";
import { useCachedQuery } from "./useCachedQuery";
import { useSession } from "./useSession";

const NO_SESSION = new ApiError("Se requiere una sesión municipal válida para consultar el total de inspecciones.", { status: 401, code: "SESION_REQUERIDA" });

export function useInspectionSummary() {
  const { session } = useSession();
  const load = useCallback(() => session ? getInspectionSummary({ session }) : Promise.reject(NO_SESSION), [session]);
  const state = useCachedQuery(session ? queryKey("inspection-summary") : null, load, session ?? undefined);
  if (!session) return { ...state, status: "unauthenticated" as const, data: null, error: NO_SESSION };
  if (state.status === "error") {
    const status = state.error.status === 401 ? "unauthenticated" : state.error.status === 403 ? "forbidden" : "error";
    return { ...state, status } as const;
  }
  return state;
}
