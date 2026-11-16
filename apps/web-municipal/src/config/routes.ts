import { parseRankingSearch, rankingFilterKey } from "./ranking-filters";

export const routes = {
  home: "/",
  map: "/mapa",
  login: "/login",
  summary: "/resumen",
  ranking: "/ranking",
  terreno: "/terreno",
} as const;

export type PointNavigationContext = {
  returnTo: string;
  rankingPeriod: string | null;
  rankingVersion: string | null;
};

export function parsePointId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function safeRankingReturnTo(value: string | undefined): string {
  if (!value || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return routes.ranking;
  try {
    decodeURIComponent(value);
    const url = new URL(value, "https://alervi.local");
    if (url.origin !== "https://alervi.local" || url.pathname !== routes.ranking) return routes.ranking;
    const search = rankingFilterKey(url.searchParams);
    if (!parseRankingSearch(new URLSearchParams(search)).query) return routes.ranking;
    return `${routes.ranking}${search ? `?${search}` : ""}`;
  } catch {
    return routes.ranking;
  }
}

export function publicMapHref(id: number, returnTo: string): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError("El identificador del punto debe ser un entero positivo.");
  const search = new URLSearchParams({ punto: String(id), returnTo: safeRankingReturnTo(returnTo) });
  return `${routes.map}?${search}`;
}

function safePointReturnTo(value: string | undefined): string {
  if (!value || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return routes.ranking;
  try {
    decodeURIComponent(value);
    const url = new URL(value, "https://alervi.local");
    if (url.origin !== "https://alervi.local") return routes.ranking;
    if (url.pathname === routes.ranking) return safeRankingReturnTo(value);
    return url.pathname === routes.summary ? routes.summary : routes.ranking;
  } catch {
    return routes.ranking;
  }
}

export function pointDetailHref(id: number, context: Partial<PointNavigationContext> = {}): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError("El identificador del punto debe ser un entero positivo.");
  const search = new URLSearchParams({ volver: safePointReturnTo(context.returnTo) });
  if (context.rankingPeriod) search.set("periodo_origen", context.rankingPeriod);
  if (context.rankingVersion) search.set("version_origen", context.rankingVersion);
  return `/puntos/${id}?${search}`;
}

export function parsePointNavigationContext(search: Record<string, string | string[] | undefined>): PointNavigationContext {
  function text(name: string): string | null {
    const value = search[name];
    return typeof value === "string" && value.trim() && value.length <= 160 ? value.trim() : null;
  }
  return {
    returnTo: safePointReturnTo(typeof search.volver === "string" ? search.volver : undefined),
    rankingPeriod: text("periodo_origen"),
    rankingVersion: text("version_origen"),
  };
}

export type InspectionView = "nueva" | "historial";
export type InspectionNavigationContext = {
  id: number | null;
  view: InspectionView;
  returnTo: string;
  hasOrigin: boolean;
  invalid: boolean;
};

function safeInspectionReturnTo(value: string | undefined): string {
  if (!value || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return routes.ranking;
  try {
    decodeURIComponent(value);
    const url = new URL(value, "https://alervi.local");
    if (url.origin !== "https://alervi.local") return routes.ranking;
    const pointPath = /^\/puntos\/([1-9]\d*)$/.exec(url.pathname);
    const id = pointPath ? parsePointId(pointPath[1]) : null;
    if (id !== null) {
      const context = parsePointNavigationContext({
        volver: url.searchParams.getAll("volver").length === 1 ? url.searchParams.get("volver") ?? undefined : undefined,
        periodo_origen: url.searchParams.getAll("periodo_origen").length === 1 ? url.searchParams.get("periodo_origen") ?? undefined : undefined,
        version_origen: url.searchParams.getAll("version_origen").length === 1 ? url.searchParams.get("version_origen") ?? undefined : undefined,
      });
      return pointDetailHref(id, context);
    }
    return safePointReturnTo(value);
  } catch {
    return routes.ranking;
  }
}

export function inspectionHref(id: number | null, view: InspectionView, returnTo?: string): string {
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new RangeError("El identificador del punto debe ser un entero positivo.");
  const search = new URLSearchParams();
  if (id !== null) search.set("punto", String(id));
  search.set("vista", view);
  if (returnTo) search.set("volver", safeInspectionReturnTo(returnTo));
  return `${routes.terreno}?${search}`;
}

export function parseInspectionNavigationContext(search: Record<string, string | string[] | undefined>): InspectionNavigationContext {
  const id = typeof search.punto === "string" ? parsePointId(search.punto) : null;
  const validView = search.vista === undefined || search.vista === "nueva" || search.vista === "historial";
  return {
    id,
    view: search.vista === "nueva" ? "nueva" : "historial",
    returnTo: safeInspectionReturnTo(typeof search.volver === "string" ? search.volver : undefined),
    hasOrigin: typeof search.volver === "string",
    invalid: (search.punto !== undefined && id === null) || !validView,
  };
}

export function safeLoginReturnTo(value: string | undefined): string {
  if (!value || value.length > 8192 || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return routes.summary;
  try {
    decodeURIComponent(value);
    const url = new URL(value, "https://alervi.local");
    if (url.origin !== "https://alervi.local") return routes.summary;
    if (url.pathname === routes.summary) return routes.summary;
    if (url.pathname === routes.ranking) return safeRankingReturnTo(value);
    const search: Record<string, string | undefined> = {};
    for (const name of ["punto", "vista", "volver", "periodo_origen", "version_origen"]) {
      const values = url.searchParams.getAll(name);
      if (values.length > 1) return routes.summary;
      search[name] = values[0];
    }
    const match = /^\/puntos\/([1-9]\d*)$/.exec(url.pathname);
    const id = match ? parsePointId(match[1]) : null;
    if (id !== null) return pointDetailHref(id, parsePointNavigationContext(search));
    if (url.pathname === routes.terreno) {
      const context = parseInspectionNavigationContext(search);
      if (!context.invalid) return inspectionHref(context.id, context.view, context.hasOrigin ? context.returnTo : undefined);
    }
    return routes.summary;
  } catch {
    return routes.summary;
  }
}

export function loginHref(returnTo?: string): string {
  return `${routes.login}?${new URLSearchParams({ returnTo: safeLoginReturnTo(returnTo) })}`;
}
