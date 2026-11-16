"use client";

import { useCallback, useMemo } from "react";
import { initialRankingQuery } from "../config/ranking";
import { ApiError } from "../services/api";
import { queryKey } from "../services/query-cache";
import { getRanking, type RankingQuery } from "../services/ranking";
import { useCachedQuery } from "./useCachedQuery";
import { useSession } from "./useSession";

const NO_SESSION = new ApiError("Se requiere una sesión municipal válida para consultar el ranking.", { status: 401, code: "SESION_REQUERIDA" });

export function useRanking(query: RankingQuery | null = initialRankingQuery) {
  const { session } = useSession();
  const { comuna, anio, periodo_inicio, periodo_fin, limit, offset } = query ?? {};
  const stableQuery = useMemo(() => ({ comuna, anio, periodo_inicio, periodo_fin, limit, offset }), [comuna, anio, periodo_inicio, periodo_fin, limit, offset]);
  const key = queryKey("ranking", stableQuery);
  const load = useCallback(() => session ? getRanking(stableQuery, { session }) : Promise.reject(NO_SESSION), [session, stableQuery]);
  const state = useCachedQuery(query && session ? key : null, load, session ?? undefined);
  if (!session) return { ...state, status: "unauthenticated" as const, data: null, error: NO_SESSION, queryKey: key };
  if (state.status === "error") {
    const status = state.error.status === 401 ? "unauthenticated" : state.error.status === 403 ? "forbidden" : "error";
    return { ...state, status, queryKey: key } as const;
  }
  return { ...state, queryKey: key };
}
