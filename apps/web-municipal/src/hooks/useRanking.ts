"use client";

import { useCallback, useEffect, useState } from "react";
import { initialRankingQuery } from "../config/ranking";
import { ApiError } from "../services/api";
import { getRanking, type RankingResponse } from "../services/ranking";
import type { Session } from "../types/session";
import { useSession } from "./useSession";

type RankingState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: RankingResponse; error: null }
  | { status: "error" | "unauthenticated" | "forbidden"; data: null; error: ApiError };

type Snapshot = {
  session: Session;
  attempt: number;
  state: RankingState;
};

const LOADING: RankingState = { status: "loading", data: null, error: null };
const NO_SESSION: RankingState = {
  status: "unauthenticated",
  data: null,
  error: new ApiError("Se requiere una sesión municipal válida para consultar el ranking.", {
    status: 401,
    code: "SESION_REQUERIDA",
  }),
};

export function useRanking() {
  const { session } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const refetch = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let active = true;

    getRanking(initialRankingQuery, { session, signal: controller.signal })
      .then((data) => {
        if (active) setSnapshot({ session, attempt, state: { status: "success", data, error: null } });
      })
      .catch((reason: unknown) => {
        if (!active || controller.signal.aborted || session.signal.aborted) return;
        const error = reason instanceof ApiError ? reason : new ApiError(
          "No se pudo consultar el ranking. Intenta nuevamente.",
          { status: 0, code: "ERROR_RANKING" },
        );
        const status = error.status === 401 ? "unauthenticated" : error.status === 403 ? "forbidden" : "error";
        setSnapshot({ session, attempt, state: { status, data: null, error } });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [session, attempt]);

  const state = !session ? NO_SESSION :
    snapshot?.session === session && snapshot.attempt === attempt ? snapshot.state : LOADING;
  return { ...state, refetch };
}
