"use client";

import { useCallback, useMemo, useState } from "react";
import type { MapFocusPoint } from "../components/Map/RiskMap";
import { useRanking } from "./useRanking";
import { useRiskPoints } from "./useRiskPoints";

type Selection = { id: number | null; source: "ranking" | "public"; revision: number };

export function useDashboard() {
  const ranking = useRanking();
  const map = useRiskPoints();
  const [selection, setSelection] = useState<Selection>({ id: null, source: "ranking", revision: 0 });
  const selectedPriority = ranking.data?.puntos.find((point) => point.id_punto === selection.id) ?? null;
  const selectedPublicPoint = map.points.find((point) => point.id_punto === selection.id) ?? null;
  const selectedPoint = selection.source === "ranking" ? selectedPriority : selectedPublicPoint;

  const focusPoint = useMemo<MapFocusPoint | null>(() => {
    if (selection.source !== "ranking" || !selectedPriority || !selectedPublicPoint) return null;
    // El mismo ID ubica la prioridad sin sustituir métricas públicas por las del ranking.
    return {
      point: selectedPublicPoint,
      scopeLabel: "Capa pública general, sin filtro temporal. Punto localizado desde las prioridades municipales.",
    };
  }, [selection.source, selectedPriority, selectedPublicPoint]);

  function selectPriority(id: number) {
    if (!ranking.data?.puntos.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source: "ranking", revision: previous.revision + 1 }));
  }

  function selectMapPoint(id: number) {
    if (!map.points.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source: "public", revision: previous.revision + 1 }));
  }

  const refreshRanking = ranking.refetch;
  const refreshMap = map.refetch;
  const refresh = useCallback(() => {
    refreshRanking();
    refreshMap();
  }, [refreshRanking, refreshMap]);

  return {
    ranking,
    map,
    focusPoint,
    selectedId: selectedPoint?.id_punto ?? null,
    selectedMapId: selectedPoint && selectedPublicPoint ? selectedPublicPoint.id_punto : null,
    selectedName: selectedPoint?.nombre_interseccion ?? null,
    missingPublicLocation: selection.source === "ranking" && selectedPriority !== null && map.status === "success" && selectedPublicPoint === null,
    selectionRevision: selection.revision,
    selectPriority,
    selectMapPoint,
    refresh,
  };
}
