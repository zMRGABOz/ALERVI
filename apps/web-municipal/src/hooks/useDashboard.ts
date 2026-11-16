"use client";

import { useCallback, useMemo, useState } from "react";
import type { MapFocusPoint } from "../components/Map/RiskMap";
import { filterDisplayedPoints, type PointDisplayFilter } from "../config/point-display-filters";
import { useInspectionSummary } from "./useInspectionSummary";
import { useRanking } from "./useRanking";
import { useRiskPoints } from "./useRiskPoints";

type Selection = { id: number | null; source: "ranking" | "public"; revision: number };

export function useDashboard() {
  const ranking = useRanking();
  const map = useRiskPoints();
  const inspections = useInspectionSummary();
  const [filter, setFilter] = useState<PointDisplayFilter | null>(null);
  const inspectionCounts = useMemo(() => inspections.data ? new Map(inspections.data.puntos.map((point) => [point.id_punto, point.total_fichas_inspeccion])) : null, [inspections.data]);
  const rankingMapPoints = useMemo(() => {
    const publicPointsById = new Map(map.points.map((point) => [point.id_punto, point]));
    return ranking.data?.puntos.flatMap((priority) => {
      const point = publicPointsById.get(priority.id_punto);
      return point ? [point] : [];
    }) ?? [];
  }, [map.points, ranking.data]);
  const visibleMapPoints = useMemo(() => filter ? filterDisplayedPoints(map.points, filter, inspectionCounts) : rankingMapPoints, [map.points, filter, inspectionCounts, rankingMapPoints]);
  const waitingForCounts = filter?.criterion === "fichas" && inspections.status === "loading";
  const filterError = filter?.criterion === "fichas" ? inspections.error : null;
  const pointsError = map.error ?? (filter ? filterError?.message : ranking.error?.message) ?? null;
  const pointsLoading = !pointsError && (map.status === "loading" || (!filter && ranking.status === "loading") || waitingForCounts);
  const displayedPointCount = pointsLoading || pointsError ? null : visibleMapPoints.length;
  const [selection, setSelection] = useState<Selection>({ id: null, source: "ranking", revision: 0 });
  const selectedPriority = ranking.data?.puntos.find((point) => point.id_punto === selection.id) ?? null;
  const selectedPublicPoint = visibleMapPoints.find((point) => point.id_punto === selection.id) ?? null;
  const originalPublicPoint = map.points.find((point) => point.id_punto === selection.id) ?? null;
  const selectedPoint = !filter && selection.source === "ranking" ? selectedPriority : selectedPublicPoint;

  const focusPoint = useMemo<MapFocusPoint | null>(() => {
    if (filter || selection.source !== "ranking" || !selectedPriority || !selectedPublicPoint) return null;
    // El mismo ID ubica la prioridad sin sustituir métricas públicas por las del ranking.
    return {
      point: selectedPublicPoint,
      scopeLabel: "Capa pública general, sin filtro temporal. Punto localizado desde las prioridades municipales.",
    };
  }, [filter, selection.source, selectedPriority, selectedPublicPoint]);

  function selectPriority(id: number) {
    if (!ranking.data?.puntos.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source: "ranking", revision: previous.revision + 1 }));
  }

  function selectMapPoint(id: number) {
    if (!visibleMapPoints.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source: "public", revision: previous.revision + 1 }));
  }

  const refreshRanking = ranking.refetch;
  const refreshMap = map.refetch;
  const refreshInspections = inspections.refetch;
  const refresh = useCallback(() => {
    refreshRanking();
    refreshMap();
    refreshInspections();
  }, [refreshRanking, refreshMap, refreshInspections]);

  return {
    ranking,
    map,
    inspections,
    filter,
    setFilter,
    inspectionCounts,
    visibleMapPoints,
    displayedPointCount,
    pointsLoading,
    pointsError,
    waitingForCounts,
    filterError,
    focusPoint,
    selectedId: selectedPoint?.id_punto ?? null,
    selectedMapId: selectedPoint && selectedPublicPoint ? selectedPublicPoint.id_punto : null,
    selectedName: selectedPoint?.nombre_interseccion ?? null,
    missingPublicLocation: !filter && selection.source === "ranking" && selectedPriority !== null && map.status === "success" && originalPublicPoint === null,
    hiddenSelection: filter !== null && map.status === "success" && !waitingForCounts && !filterError && originalPublicPoint !== null && selectedPublicPoint === null,
    selectionRevision: selection.revision,
    selectPriority,
    selectMapPoint,
    refresh,
  };
}
