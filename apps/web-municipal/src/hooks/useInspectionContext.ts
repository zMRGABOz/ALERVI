"use client";

import { useCallback } from "react";
import { getInspectionPoint, loadInspectionCatalog } from "../integrations/inspection-module";
import { ApiError } from "../services/api";
import { getCachedQuery, invalidateQueryGroup, queryKey } from "../services/query-cache";
import { useCachedQuery } from "./useCachedQuery";
import { useSession } from "./useSession";

const NO_SESSION = new ApiError("Se requiere una sesión municipal válida.", { status: 401, code: "SESION_REQUERIDA" });

export function useInspectionContext(id: number | null) {
  const { session } = useSession();
  const loadCatalog = useCallback(() => session ? loadInspectionCatalog({ session }) : Promise.reject(NO_SESSION), [session]);
  const loadPoint = useCallback(() => session && id !== null ? getInspectionPoint(id, { session }) : Promise.reject(NO_SESSION), [id, session]);
  const catalog = useCachedQuery(session ? queryKey("inspection-catalog") : null, loadCatalog, session ?? undefined);
  const point = useCachedQuery(id !== null && session ? queryKey("inspection-context", { id }) : null, loadPoint, session ?? undefined);
  const refreshPoint = point.refetch;
  const refreshCatalog = catalog.refetch;
  const refetch = useCallback(() => {
    if (!session || id === null) return;
    getCachedQuery(queryKey("point-detail", { id }), session).invalidate();
    getCachedQuery(queryKey("inspection-history", { id }), session).invalidate();
    refreshPoint();
  }, [id, session, refreshPoint]);
  const refetchCatalog = useCallback(() => {
    if (!session) return;
    invalidateQueryGroup("risk-points");
    invalidateQueryGroup("inspection-factors", session);
    refreshCatalog();
  }, [session, refreshCatalog]);
  return { catalog, point: id === null ? { ...point, status: "idle" as const, data: null, error: null } : point, refetch, refetchCatalog };
}
