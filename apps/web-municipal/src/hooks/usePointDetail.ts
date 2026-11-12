"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../services/api";
import { getPointDetail, type PointDetail } from "../services/puntos";
import type { Session } from "../types/session";
import { useSession } from "./useSession";

type DetailState =
  | { status: "loading"; data: null; error: null }
  | { status: "invalid-id"; data: null; error: null }
  | { status: "success"; data: PointDetail; error: null }
  | { status: "error" | "not-found" | "unscored" | "unauthenticated" | "forbidden"; data: null; error: ApiError };
type Snapshot = { id: number; session: Session; attempt: number; state: DetailState };
const LOADING: DetailState = { status: "loading", data: null, error: null };

export function usePointDetail(id: number | null) {
  const { session } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const refetch = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (id === null || !session) return;
    const controller = new AbortController();
    let active = true;
    getPointDetail(id, { session, signal: controller.signal })
      .then((data) => {
        if (active) setSnapshot({ id, session, attempt, state: { status: "success", data, error: null } });
      })
      .catch((reason: unknown) => {
        if (!active || controller.signal.aborted || session.signal.aborted) return;
        const error = reason instanceof ApiError ? reason : new ApiError("No se pudo consultar el detalle del punto.", { status: 0, code: "ERROR_DETALLE" });
        const status = error.status === 401 ? "unauthenticated" : error.status === 403 ? "forbidden" : error.code === "SIN_INDICE_DISPONIBLE" ? "unscored" : error.status === 404 ? "not-found" : "error";
        setSnapshot({ id, session, attempt, state: { status, data: null, error } });
      });
    return () => { active = false; controller.abort(); };
  }, [id, session, attempt]);

  const state: DetailState = id === null ? { status: "invalid-id", data: null, error: null }
    : !session ? { status: "unauthenticated", data: null, error: new ApiError("Se requiere una sesión municipal válida.", { status: 401, code: "SESION_REQUERIDA" }) }
      : snapshot?.id === id && snapshot.session === session && snapshot.attempt === attempt ? snapshot.state : LOADING;
  return { ...state, refetch };
}
