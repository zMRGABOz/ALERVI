export const routes = {
  home: "/",
  map: "/mapa",
  summary: "/resumen",
  ranking: "/ranking",
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

function safePointReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return routes.ranking;
  try {
    const url = new URL(value, "https://alervi.local");
    if (url.origin !== "https://alervi.local" || (url.pathname !== routes.ranking && url.pathname !== routes.summary)) return routes.ranking;
    return `${url.pathname}${url.search}${url.hash}`;
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
