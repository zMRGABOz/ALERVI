"use client";

import { useCallback, useEffect, useState } from "react";
import { getInspectionPoint, loadInspectionCatalog, type InspectionPoint } from "../integrations/inspection-module";
import { ApiError } from "../services/api";
import type { Session } from "../types/session";
import { useSession } from "./useSession";

type State<T> = { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: ApiError };
type Catalog = Awaited<ReturnType<typeof loadInspectionCatalog>>;
type Snapshot<T> = { session: Session; attempt: number; state: State<T> };
const LOADING = { status: "loading", data: null, error: null } as const;
const NO_POINT = { status: "idle", data: null, error: null } as const;

export function useInspectionContext(id: number | null) {
  const { session } = useSession();
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [catalogSnapshot, setCatalogSnapshot] = useState<Snapshot<Catalog> | null>(null);
  const [snapshot, setSnapshot] = useState<(Snapshot<InspectionPoint> & { id: number }) | null>(null);
  const refetch = useCallback(() => setAttempt((value) => value + 1), []);
  const refetchCatalog = useCallback(() => setCatalogAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let active = true;
    loadInspectionCatalog({ session, signal: controller.signal }).then((data) => {
      if (active) setCatalogSnapshot({ session, attempt: catalogAttempt, state: { status: "success", data, error: null } });
    }).catch((reason: unknown) => {
      if (!active || controller.signal.aborted || session.signal.aborted) return;
      const error = reason instanceof ApiError ? reason : new ApiError("No se pudieron consultar los puntos y factores de terreno.", { status: 0, code: "ERROR_CATALOGO_TERRENO" });
      setCatalogSnapshot({ session, attempt: catalogAttempt, state: { status: "error", data: null, error } });
      controller.abort();
    });
    return () => { active = false; controller.abort(); };
  }, [session, catalogAttempt]);

  useEffect(() => {
    if (id === null || !session) return;
    const controller = new AbortController();
    let active = true;
    getInspectionPoint(id, { session, signal: controller.signal }).then((data) => {
      if (active) setSnapshot({ id, session, attempt, state: { status: "success", data, error: null } });
    }).catch((reason: unknown) => {
      if (!active || controller.signal.aborted || session.signal.aborted) return;
      const error = reason instanceof ApiError ? reason : new ApiError("No se pudo preparar el contexto de terreno.", { status: 0, code: "ERROR_TERRENO" });
      setSnapshot({ id, session, attempt, state: { status: "error", data: null, error } });
      controller.abort();
    });
    return () => { active = false; controller.abort(); };
  }, [id, session, attempt]);

  const catalog = catalogSnapshot?.session === session && catalogSnapshot.attempt === catalogAttempt ? catalogSnapshot.state : LOADING;
  const point = id === null ? NO_POINT : snapshot?.id === id && snapshot.session === session && snapshot.attempt === attempt ? snapshot.state : LOADING;
  return { catalog, point, refetch, refetchCatalog };
}
