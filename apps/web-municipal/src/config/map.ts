import { env } from "./env";

export type MapPosition = [longitude: number, latitude: number];

const cartoHosts = new Set(["basemaps.cartocdn.com", "tiles.basemaps.cartocdn.com"]);
const cartoStyleUrl = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export function withCartoBasemapKey(resource: string, key = env.cartoBasemapKey): string {
  if (!key) return resource;
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return resource;
  }
  if (url.protocol !== "https:" || !cartoHosts.has(url.hostname)) return resource;
  url.searchParams.set("key", key);
  return url.href;
}

export const publicMapConfig = {
  comuna: "Concepción",
  // MapLibre y GeoJSON usan [longitud, latitud].
  center: [-73.05, -36.827] satisfies MapPosition,
  zoom: 14,
  minZoom: 10,
  maxZoom: 19,
  styleUrl: withCartoBasemapKey(cartoStyleUrl),
} as const;
