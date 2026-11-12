"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { parseRankingSearch, rankingFilterSearch, type RankingFiltersValue } from "../config/ranking-filters";

export function useRankingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const parsed = useMemo(() => parseRankingSearch(new URLSearchParams(search)), [search]);

  function navigate(filters: RankingFiltersValue | null) {
    const query = rankingFilterSearch(new URLSearchParams(search), filters);
    router.push(`${pathname}${query ? `?${query}` : ""}${window.location.hash}`, { scroll: false });
  }

  return {
    ...parsed,
    formKey: search,
    apply: (filters: RankingFiltersValue) => navigate(filters),
    reset: () => navigate(null),
  };
}
