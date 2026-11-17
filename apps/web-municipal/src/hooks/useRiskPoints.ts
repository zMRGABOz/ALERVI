"use client";

import { useCallback, useMemo } from "react";
import { toPublicRiskPoints } from "../components/Map/public-points";
import { publicMapConfig } from "../config/map";
import { queryKey } from "../services/query-cache";
import { getRiskPoints } from "../services/riesgo";
import { useCachedQuery } from "./useCachedQuery";

const publicQuery = { comuna: publicMapConfig.comuna };

export function useRiskPoints() {
  const load = useCallback(() => getRiskPoints(publicQuery), []);
  const query = useCachedQuery(queryKey("risk-points", publicQuery), load);
  const points = useMemo(() => query.data ? toPublicRiskPoints(query.data) : [], [query.data]);
  return { ...query, points, error: query.error?.message ?? null };
}
