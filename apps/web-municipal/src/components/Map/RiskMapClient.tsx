"use client";

import { GeoJSONSource, LngLatBounds, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { publicMapConfig, withCartoBasemapKey } from "../../config/map";
import { riskLevels } from "../../config/risk-levels";
import { toMapLibrePoints, toMapPosition, type RiskColors } from "./maplibre-points";
import { formatRiskIndex, type PublicRiskPoint } from "./public-points";
import type { RiskMapProps } from "./RiskMap";

// Next emite este recurso del paquete junto al bundle; no depende de un CDN de workers.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const POINTS_SOURCE = "alervi-public-points";
const POINTS_LAYER = "alervi-risk-points";
const SELECTION_LAYER = "alervi-point-selection";
const PUBLIC_SCOPE = "Capa pública general, sin filtro temporal.";
const LOADING = { status: "loading" } as const;
const READY = { status: "ready" } as const;

type CartographyState = typeof LOADING | typeof READY | {
  status: "error" | "unsupported";
  message: string;
};
type MapSnapshot = {
  points: readonly PublicRiskPoint[];
  selectedId: number | null;
  selectionRevision: number;
  scopeLabel: string;
  onSelect: RiskMapProps["onSelect"];
};
type MapColors = { risks: RiskColors; surface: string; heading: string };

function readMapColors(container: HTMLElement): MapColors {
  const style = getComputedStyle(container);
  const resolve = (value: string) => style.getPropertyValue(value.slice(4, -1)).trim();
  return {
    risks: {
      CRITICO: resolve(riskLevels.CRITICO.color),
      ALTO: resolve(riskLevels.ALTO.color),
      MEDIO: resolve(riskLevels.MEDIO.color),
      BAJO: resolve(riskLevels.BAJO.color),
    },
    surface: style.getPropertyValue("--color-surface").trim(),
    heading: style.getPropertyValue("--color-heading").trim(),
  };
}

function addRiskLayers(map: MapLibreMap, snapshot: MapSnapshot, colors: MapColors) {
  map.addSource(POINTS_SOURCE, { type: "geojson", data: toMapLibrePoints(snapshot.points, colors.risks) });
  map.addLayer({
    id: SELECTION_LAYER,
    type: "circle",
    source: POINTS_SOURCE,
    filter: ["==", ["get", "id_punto"], snapshot.selectedId ?? -1],
    paint: {
      "circle-radius": 15,
      "circle-opacity": 0,
      "circle-stroke-width": 2,
      "circle-stroke-color": colors.heading,
    },
  });
  map.addLayer({
    id: POINTS_LAYER,
    type: "circle",
    source: POINTS_SOURCE,
    paint: {
      "circle-radius": 8,
      "circle-color": ["get", "marker_color"],
      "circle-stroke-width": 2,
      "circle-stroke-color": colors.surface,
    },
  });
}

function fitAllPoints(map: MapLibreMap, points: readonly PublicRiskPoint[]) {
  if (!points.length) return;
  const bounds = new LngLatBounds();
  for (const point of points) bounds.extend(toMapPosition(point.position));
  map.fitBounds(bounds, { padding: 32, maxZoom: 16, duration: 0 });
}

function pointPopup(point: PublicRiskPoint, scopeLabel: string, onClose: () => void): HTMLElement {
  const content = document.createElement("div");
  content.className = "public-point-popup";
  const header = document.createElement("div");
  header.className = "public-point-popup__header";
  const title = document.createElement("h3");
  title.textContent = point.nombre_interseccion;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.setAttribute("aria-label", "Cerrar información del punto");
  const closeSymbol = document.createElement("span");
  closeSymbol.textContent = "×";
  closeSymbol.setAttribute("aria-hidden", "true");
  close.append(closeSymbol);
  close.addEventListener("click", onClose);
  header.append(title, close);

  const priority = document.createElement("div");
  priority.className = "public-point-popup__priority";
  const level = document.createElement("span");
  level.className = "risk-badge";
  level.textContent = riskLevels[point.nivel_riesgo].label;
  level.style.color = riskLevels[point.nivel_riesgo].color;
  level.style.backgroundColor = riskLevels[point.nivel_riesgo].background;
  const index = document.createElement("span");
  index.textContent = `IP ${formatRiskIndex(point.indice_prioridad)}/100`;
  priority.append(level, index);
  const counts = document.createElement("p");
  counts.textContent = `${point.total_siniestros} siniestros registrados · ${point.comuna}`;
  content.append(header, priority, counts);
  if (point.resumen_publico) {
    const summary = document.createElement("p");
    summary.textContent = point.resumen_publico;
    content.append(summary);
  }
  const scope = document.createElement("p");
  scope.className = "text-muted";
  scope.textContent = scopeLabel;
  content.append(scope);
  return content;
}

function updateSelection(map: MapLibreMap, popup: Popup, snapshot: MapSnapshot) {
  if (map.getLayer(SELECTION_LAYER)) {
    map.setFilter(SELECTION_LAYER, ["==", ["get", "id_punto"], snapshot.selectedId ?? -1]);
  }
  const selected = snapshot.points.find((point) => point.id_punto === snapshot.selectedId);
  popup.remove();
  if (!selected) return;
  const position = toMapPosition(selected.position);
  // Movimientos sin animación, también con prefers-reduced-motion.
  map.easeTo({
    center: position,
    zoom: Math.max(map.getZoom(), 16),
    offset: [0, Math.min(96, map.getContainer().clientHeight / 4)],
    duration: 0,
  });
  popup.setLngLat(position)
    .setDOMContent(pointPopup(selected, snapshot.scopeLabel, () => {
      popup.remove();
      map.getCanvas().focus({ preventScroll: true });
    }))
    .addTo(map);
}

function cartographyError(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
  if (status === 401 || status === 403) {
    return `CARTO rechazó el acceso al mapa base (HTTP ${status}). Revisa la clave pública y sus restricciones de acceso. La lista de puntos sigue disponible.`;
  }
  return "No se pudo cargar el estilo o parte de los recursos de CARTO. Revisa la conexión e intenta nuevamente. La lista de puntos sigue disponible.";
}

export default function RiskMapClient({ points, selectedId, selectionRevision = 0, onSelect, focusPoint, ariaLabel = "Mapa público de puntos críticos de Concepción" }: RiskMapProps) {
  const displayedPoints = useMemo(() => {
    if (!focusPoint) return points;
    return points.some((point) => point.id_punto === focusPoint.point.id_punto)
      ? points.map((point) => point.id_punto === focusPoint.point.id_punto ? focusPoint.point : point)
      : [...points, focusPoint.point];
  }, [points, focusPoint]);
  const scopeLabel = focusPoint?.point.id_punto === selectedId ? focusPoint.scopeLabel : PUBLIC_SCOPE;
  const snapshotRef = useRef<MapSnapshot>({ points: displayedPoints, selectedId, selectionRevision, scopeLabel, onSelect });
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const colorsRef = useRef<MapColors | null>(null);
  const [cartography, setCartography] = useState<CartographyState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const previous = snapshotRef.current;
    const snapshot = { points: displayedPoints, selectedId, selectionRevision, scopeLabel, onSelect };
    snapshotRef.current = snapshot;
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup) return;
    const pointsChanged = previous.points !== displayedPoints;
    if (pointsChanged && colorsRef.current) {
      const source = map.getSource(POINTS_SOURCE);
      if (source instanceof GeoJSONSource) source.setData(toMapLibrePoints(displayedPoints, colorsRef.current.risks));
      fitAllPoints(map, displayedPoints);
    }
    if (pointsChanged || previous.selectedId !== selectedId || previous.selectionRevision !== selectionRevision || previous.scopeLabel !== scopeLabel) {
      updateSelection(map, popup, snapshot);
    }
  }, [displayedPoints, selectedId, selectionRevision, scopeLabel, onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let failed = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    const popup = new Popup({ anchor: "bottom", closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: "min(280px, calc(100% - 24px))", offset: 16 });
    const timeout = window.setTimeout(() => {
      if (active) {
        failed = true;
        setCartography({ status: "error", message: "CARTO tardó demasiado en cargar el mapa base. Puedes reintentar y seguir consultando la lista de puntos." });
      }
    }, 20_000);

    try {
      const colors = readMapColors(container);
      colorsRef.current = colors;
      map = new MapLibreMap({
        container,
        style: publicMapConfig.styleUrl,
        center: publicMapConfig.center,
        zoom: publicMapConfig.zoom,
        minZoom: publicMapConfig.minZoom,
        maxZoom: publicMapConfig.maxZoom,
        maxPitch: 0,
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        scrollZoom: false,
        renderWorldCopies: false,
        attributionControl: { compact: false },
        transformRequest: (url) => ({ url: withCartoBasemapKey(url), credentials: "same-origin" }),
        locale: {
          "Map.Title": "Mapa de Concepción",
          "NavigationControl.ZoomIn": "Acercar",
          "NavigationControl.ZoomOut": "Alejar",
          "AttributionControl.ToggleAttribution": "Mostrar atribuciones del mapa",
        },
      });
      const currentMap = map;
      mapRef.current = currentMap;
      popupRef.current = popup;
      currentMap.touchZoomRotate.disableRotation();
      currentMap.keyboard.disableRotation();
      currentMap.addControl(new NavigationControl({ showCompass: false }), "top-left");
      currentMap.on("style.load", () => {
        if (!active) return;
        const snapshot = snapshotRef.current;
        addRiskLayers(currentMap, snapshot, colors);
        fitAllPoints(currentMap, snapshot.points);
        updateSelection(currentMap, popup, snapshot);
      });
      currentMap.on("dataloading", (event) => {
        if ("sourceId" in event && event.sourceId === POINTS_SOURCE) return;
        if (active && !failed) setCartography(LOADING);
      });
      currentMap.on("idle", () => {
        if (!active) return;
        window.clearTimeout(timeout);
        if (!failed) setCartography(READY);
      });
      currentMap.on("error", (event) => {
        if (!active) return;
        failed = true;
        window.clearTimeout(timeout);
        setCartography({ status: "error", message: cartographyError(event.error) });
      });
      currentMap.on("webglcontextlost", () => {
        if (!active) return;
        failed = true;
        setCartography({ status: "unsupported", message: "El navegador perdió el contexto gráfico del mapa. Puedes reintentar o consultar los puntos desde la lista." });
      });
      currentMap.on("click", POINTS_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.id_punto;
        const snapshot = snapshotRef.current;
        if (typeof id === "number" && snapshot.points.some((point) => point.id_punto === id)) snapshot.onSelect(id);
      });
      currentMap.on("mouseenter", POINTS_LAYER, () => { currentMap.getCanvas().style.cursor = "pointer"; });
      currentMap.on("mouseleave", POINTS_LAYER, () => { currentMap.getCanvas().style.cursor = ""; });
      let width = container.clientWidth;
      let height = container.clientHeight;
      observer = new ResizeObserver(() => {
        if (width === container.clientWidth && height === container.clientHeight) return;
        width = container.clientWidth;
        height = container.clientHeight;
        currentMap.resize();
        if (snapshotRef.current.selectedId !== null) updateSelection(currentMap, popup, snapshotRef.current);
      });
      observer.observe(container);
    } catch {
      failed = true;
      window.clearTimeout(timeout);
      map?.remove();
      map = null;
      mapRef.current = null;
      popupRef.current = null;
      container.replaceChildren();
      queueMicrotask(() => {
        if (active) setCartography({ status: "unsupported", message: "No se pudo iniciar el mapa. Comprueba que el navegador admita WebGL 2 y tenga aceleración gráfica disponible. La lista y la navegación siguen disponibles." });
      });
    }

    return () => {
      active = false;
      window.clearTimeout(timeout);
      observer?.disconnect();
      popup.remove();
      map?.remove();
      mapRef.current = null;
      popupRef.current = null;
    };
  }, [attempt]);

  function retryMap() {
    setCartography(LOADING);
    setAttempt((value) => value + 1);
  }

  function resetView() {
    if (!mapRef.current) return;
    popupRef.current?.remove();
    fitAllPoints(mapRef.current, snapshotRef.current.points);
  }

  return (
    <div className="risk-map">
      <div className="risk-map-toolbar">
        <p>Selecciona un marcador o un punto de la lista.</p>
        <button type="button" className="button-secondary" onClick={resetView}>Ver todos los puntos</button>
      </div>
      <div role="region" aria-label={ariaLabel} className="risk-map-viewport">
        <div ref={containerRef} className="risk-map-canvas" />
      </div>
      {cartography.status === "error" || cartography.status === "unsupported" ? (
        <div className="map-cartography-error" role="status">
          <p>{cartography.message}</p>
          <button type="button" className="button-secondary" onClick={retryMap}>Reintentar mapa base</button>
        </div>
      ) : (
        <p className="map-base-status" role="status">{cartography.status === "loading" ? "Cargando mapa vectorial de CARTO…" : "Mapa base: CARTO Positron vectorial · OpenStreetMap / CARTO"}</p>
      )}
    </div>
  );
}
