"use client";

import { latLngBounds, type CircleMarker as LeafletCircleMarker, type LeafletEventHandlerFnMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { publicMapConfig } from "../../config/map";
import { riskLevels } from "../../config/risk-levels";
import { Icon } from "../UI/Icon";
import { RiskBadge } from "../UI/RiskBadge";
import type { RiskMapProps } from "./RiskMap";
import { formatRiskIndex, type PublicRiskPoint } from "./public-points";

function MapView({ points, selectedId, selectionRevision, reset }: Pick<RiskMapProps, "points" | "selectedId" | "selectionRevision"> & { reset: number }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(latLngBounds(points.map((point) => point.position)), {
      padding: [32, 32], maxZoom: 16, animate: false,
    });
  }, [map, points, reset]);

  useEffect(() => {
    const point = points.find((item) => item.id_punto === selectedId);
    if (point) map.setView(point.position, Math.max(map.getZoom(), 16), { animate: false });
  }, [map, points, selectedId, selectionRevision]);

  useEffect(() => {
    map.closePopup();
  }, [map, reset]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function PublicMarker({ point, selected, selectionRevision, onSelect, scopeLabel = "Capa pública general, sin filtro temporal." }: {
  point: PublicRiskPoint;
  selected: boolean;
  selectionRevision: number;
  onSelect: (id: number) => void;
  scopeLabel?: string;
}) {
  const marker = useRef<LeafletCircleMarker>(null);
  const color = riskLevels[point.nivel_riesgo].color;

  useEffect(() => {
    if (selected) marker.current?.openPopup();
    else marker.current?.closePopup();
  }, [point, selected, selectionRevision]);

  return (
    <>
      {selected && (
        <CircleMarker
          center={point.position}
          radius={15}
          interactive={false}
          className="public-risk-selection"
          pathOptions={{ color: "var(--color-heading)", weight: 2, fill: false }}
        />
      )}
      <CircleMarker
        ref={marker}
        center={point.position}
        radius={8}
        className="public-risk-marker"
        pathOptions={{ color: "var(--color-surface)", weight: 2, fillColor: color, fillOpacity: 1 }}
        eventHandlers={{ click: () => onSelect(point.id_punto) }}
      >
        <Popup minWidth={200} maxWidth={280} closeButton={false}>
          <div className="public-point-popup">
            <div className="public-point-popup__header">
              <h3>{point.nombre_interseccion}</h3>
              <button type="button" className="icon-button" aria-label="Cerrar información del punto" onClick={() => marker.current?.closePopup()}><Icon name="close" size={18} /></button>
            </div>
            <div className="public-point-popup__priority"><RiskBadge level={point.nivel_riesgo} /> <span>IP {formatRiskIndex(point.indice_prioridad)}/100</span></div>
            <p>{point.total_siniestros} siniestros registrados · {point.comuna}</p>
            {point.resumen_publico && <p>{point.resumen_publico}</p>}
            <p className="text-muted">{scopeLabel}</p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

export default function RiskMapClient({ points, selectedId, selectionRevision = 0, onSelect, focusPoint, ariaLabel = "Mapa público de puntos críticos de Concepción" }: RiskMapProps) {
  const displayedPoints = useMemo(() => {
    if (!focusPoint) return points;
    const includesFocus = points.some((point) => point.id_punto === focusPoint.point.id_punto);
    return includesFocus
      ? points.map((point) => point.id_punto === focusPoint.point.id_punto ? focusPoint.point : point)
      : [...points, focusPoint.point];
  }, [points, focusPoint]);
  const failedTiles = useRef(new Set<HTMLElement>());
  const [tilesLoading, setTilesLoading] = useState(publicMapConfig.tileUrl !== null);
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [viewReset, setViewReset] = useState(0);

  const tileEvents = useMemo<LeafletEventHandlerFnMap>(() => ({
    loading: () => setTilesLoading(true),
    load: () => setTilesLoading(false),
    tileerror: (event) => {
      failedTiles.current.add(event.tile);
      setTileError(true);
    },
    tileload: (event) => {
      failedTiles.current.delete(event.tile);
      setTileError(failedTiles.current.size > 0);
    },
    tileunload: (event) => {
      failedTiles.current.delete(event.tile);
      setTileError(failedTiles.current.size > 0);
    },
  }), []);

  function retryTiles() {
    failedTiles.current.clear();
    setTileError(false);
    setTilesLoading(true);
    setTileAttempt((value) => value + 1);
  }

  return (
    <div className="risk-map">
      <div className="risk-map-toolbar">
        <p>Selecciona un marcador o un punto de la lista.</p>
        <button type="button" className="button-secondary" onClick={() => setViewReset((value) => value + 1)}>Ver todos los puntos</button>
      </div>
      <div role="region" aria-label={ariaLabel} className="risk-map-viewport">
        <MapContainer
          center={publicMapConfig.center}
          zoom={publicMapConfig.zoom}
          minZoom={10}
          maxZoom={19}
          zoomControl={false}
          zoomAnimation={false}
          scrollWheelZoom={false}
          className="risk-map-canvas"
        >
          <ZoomControl zoomInTitle="Acercar" zoomOutTitle="Alejar" />
          {publicMapConfig.tileUrl && (
            <TileLayer key={tileAttempt} url={publicMapConfig.tileUrl} attribution={publicMapConfig.attribution} subdomains="abcd" maxZoom={20} eventHandlers={tileEvents} />
          )}
          <MapView points={displayedPoints} selectedId={selectedId} selectionRevision={selectionRevision} reset={viewReset} />
          {displayedPoints.map((point) => (
            <PublicMarker
              key={point.id_punto}
              point={point}
              selected={point.id_punto === selectedId}
              selectionRevision={selectionRevision}
              onSelect={onSelect}
              scopeLabel={point.id_punto === focusPoint?.point.id_punto ? focusPoint.scopeLabel : undefined}
            />
          ))}
        </MapContainer>
      </div>
      {!publicMapConfig.tileUrl ? (
        <p className="map-base-unavailable" role="status">Mapa base pendiente de configurar. CARTO Positron requiere una clave pública de mapas; los marcadores y la lista siguen disponibles.</p>
      ) : tileError ? (
        <div className="map-tile-error" role="status">
          <p>No se pudo cargar parte del mapa base. Los marcadores y la lista de puntos siguen disponibles.</p>
          <button type="button" className="button-secondary" onClick={retryTiles}>Reintentar mapa base</button>
        </div>
      ) : (
        <p className="map-base-status" role="status">{tilesLoading ? "Cargando mapa base…" : "Mapa base: CARTO Positron · OpenStreetMap / CARTO"}</p>
      )}
    </div>
  );
}
