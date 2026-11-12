"use client";

import { useCallback, useEffect, useState } from "react";
import { toPublicRiskPoints, type PublicRiskPoint } from "../components/Map/public-points";
import { publicMapConfig } from "../config/map";
import { ApiError } from "../services/api";
import { getRiskPoints } from "../services/riesgo";

type RiskPointsState = {
  status: "loading" | "success" | "error";
  points: PublicRiskPoint[];
  error: string | null;
};

const INITIAL_STATE: RiskPointsState = { status: "loading", points: [], error: null };

export function useRiskPoints() {
  const [state, setState] = useState<RiskPointsState>(INITIAL_STATE);
  const [attempt, setAttempt] = useState(0);
  const refetch = useCallback(() => {
    setState(INITIAL_STATE);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Una consulta comunal: mover o ampliar el mapa no dispara nuevas peticiones.
    getRiskPoints({ comuna: publicMapConfig.comuna }, { signal: controller.signal })
      .then(toPublicRiskPoints)
      .then((points) => {
        if (active) setState({ status: "success", points, error: null });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: "error",
          points: [],
          error: error instanceof ApiError ? error.message : "No se pudieron consultar los puntos públicos. Intenta nuevamente.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  return { ...state, refetch };
}
