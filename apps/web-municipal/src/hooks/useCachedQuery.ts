"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { EMPTY_QUERY, getCachedQuery } from "../services/query-cache";
import type { Session } from "../types/session";

const subscribeEmpty = () => () => {};
const emptySnapshot = () => EMPTY_QUERY;

export function useCachedQuery<T>(key: string | null, load: () => Promise<T>, session?: Session) {
  const query = useMemo(() => key === null ? null : getCachedQuery<T>(key, session), [key, session]);
  const state = useSyncExternalStore(query?.subscribe ?? subscribeEmpty, query?.getSnapshot ?? emptySnapshot, emptySnapshot);
  useEffect(() => {
    if (query) void load().catch(() => {});
  }, [query, load, state.revision]);
  const refetch = useCallback(() => query?.invalidate(), [query]);
  return { ...state, refetch };
}
