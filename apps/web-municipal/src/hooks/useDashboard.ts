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
  const period = ranking.data?.periodo;

  const focusPoint = useMemo<MapFocusPoint | null>(() => {
    if (selection.source !== "ranking" || !selectedPriority || !period) return null;
    return {
      point: {
        id_punto: selectedPriority.id_punto,
        nombre_interseccion: selectedPriority.nombre_interseccion,
        comuna: selectedPriority.comuna,
        position: [selectedPriority.latitud, selectedPriority.longitud],
        nivel_riesgo: selectedPriority.nivel_riesgo,
        indice_prioridad: selectedPriority.indice_prioridad,
        total_siniestros: selectedPriority.total_siniestros,
        total_fallecidos: selectedPriority.total_fallecidos,
        total_graves: selectedPriority.total_graves,
      },
      scopeLabel: `Ranking municipal · Período ${period}. La capa pública general se consulta por separado.`,
    };
  }, [selectedPriority, period, selection.source]);

  function selectPriority(id: number) {
    if (!ranking.data?.puntos.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source: "ranking", revision: previous.revision + 1 }));
  }

  function selectMapPoint(id: number) {
    const source = focusPoint?.point.id_punto === id ? "ranking" : "public";
    if (source === "public" && !map.points.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ id: previous.id === id ? null : id, source, revision: previous.revision + 1 }));
  }

  const refreshRanking = ranking.refetch;
  const refreshMap = map.refetch;
  const refresh = useCallback(() => {
    refreshRanking();
    refreshMap();
  }, [refreshRanking, refreshMap]);
  const selectedPoint = selection.source === "ranking" ? selectedPriority : selectedPublicPoint;

  return {
    ranking,
    map,
    focusPoint,
    selectedId: selectedPoint?.id_punto ?? null,
    selectedName: selectedPoint?.nombre_interseccion ?? null,
    selectionSource: selection.source,
    selectionRevision: selection.revision,
    selectPriority,
    selectMapPoint,
    refresh,
  };
}
