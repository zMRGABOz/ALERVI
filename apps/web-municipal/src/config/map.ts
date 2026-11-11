import { env } from "./env";

export const publicMapConfig = {
  comuna: "Concepción",
  // Leaflet recibe [latitud, longitud]; el GeoJSON se adapta al leer la capa.
  center: [-36.827, -73.05] as [number, number],
  zoom: 14,
  tileUrl: env.cartoBasemapKey
    ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(env.cartoBasemapKey)}`
    : null,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;
