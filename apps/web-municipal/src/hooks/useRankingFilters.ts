"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { parseRankingSearch, rankingFilterKey, rankingFilterSearch, type RankingFiltersValue } from "../config/ranking-filters";

export function useRankingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const formKey = rankingFilterKey(new URLSearchParams(search));
  const parsed = useMemo(() => parseRankingSearch(new URLSearchParams(formKey)), [formKey]);

  function navigate(filters: RankingFiltersValue | null) {
    const query = rankingFilterSearch(new URLSearchParams(window.location.search), filters);
    router.push(`${pathname}${query ? `?${query}` : ""}${window.location.hash}`, { scroll: false });
  }

  return {
    ...parsed,
    formKey,
    apply: (filters: RankingFiltersValue) => navigate(filters),
    reset: () => navigate(null),
  };
}
