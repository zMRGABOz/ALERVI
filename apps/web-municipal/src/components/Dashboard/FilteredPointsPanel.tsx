"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { describePointDisplayFilter, type PointDisplayFilter } from "../../config/point-display-filters";
import { riskLevels } from "../../config/risk-levels";
import { pointDetailHref, routes } from "../../config/routes";
import type { useInspectionSummary } from "../../hooks/useInspectionSummary";
import type { useRiskPoints } from "../../hooks/useRiskPoints";
import { formatRiskIndex, type PublicRiskPoint } from "../Map/public-points";
import { QueryState } from "../UI/QueryState";
import { RiskBadge } from "../UI/RiskBadge";

type FilteredPointsPanelProps = {
  map: ReturnType<typeof useRiskPoints>;
  inspections: ReturnType<typeof useInspectionSummary>;
  points: readonly PublicRiskPoint[];
  filter: PointDisplayFilter;
  inspectionCounts: ReadonlyMap<number, number> | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function FilteredPointsPanel({ map, inspections, points, filter, inspectionCounts, selectedId, onSelect }: FilteredPointsPanelProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const waitingForCounts = filter.criterion === "fichas" && inspections.status === "loading";
  const filterError = filter.criterion === "fichas" ? inspections.error : null;

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!list || !selected) return;
    const item = selected.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top;
    else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
  }, [selectedId, points]);

  return (
    <section className="surface-card top-points-panel" aria-labelledby="titulo-puntos-seleccionados">
      <div className="panel-header">
        <div>
          <h2 id="titulo-puntos-seleccionados">Puntos seleccionados</h2>
        </div>
        <Link href={routes.ranking} className="inline-link">Ver ranking</Link>
      </div>
      {map.status === "loading" ? (
        <QueryState state="loading" title="Consultando puntos" description="La selección se aplica a todos los puntos de la capa comunal." />
      ) : map.status === "error" ? (
        <QueryState state="error" title="No se pudieron cargar los puntos" description={map.error ?? "Intenta nuevamente."} onRetry={map.refetch} />
      ) : waitingForCounts ? (
        <QueryState state="loading" title="Consultando cantidades de fichas" description="La selección se aplicará cuando el servicio entregue los conteos por punto." />
      ) : filterError ? (
        <QueryState state="error" title="No se pudo aplicar el filtro de fichas" description={filterError.message} onRetry={inspections.refetch} />
      ) : (
        <>
          <p className="top-point-filter-context">{describePointDisplayFilter(filter)} La numeración indica el orden de esta selección.</p>
          {points.length ? <ul ref={listRef} className="top-point-list top-point-list--selection" aria-label="Puntos seleccionados de Concepción">
            {points.map((point, index) => <li key={point.id_punto} className="top-point-card" data-selected={point.id_punto === selectedId}>
              <button
                type="button"
                className="top-point-button"
                aria-pressed={point.id_punto === selectedId}
                aria-label={`Ubicar ${point.nombre_interseccion} en el mapa. Orden ${index + 1}. IP ${formatRiskIndex(point.indice_prioridad)}. Nivel ${riskLevels[point.nivel_riesgo].label}. Fichas: ${inspectionCounts ? inspectionCounts.get(point.id_punto) ?? 0 : "no disponible"}.`}
                onClick={() => onSelect(point.id_punto)}
              >
                <span className="top-point-position">{index + 1}</span>
                <span className="top-point-content">
                  <span className="top-point-name">{point.nombre_interseccion}</span>
                  <span className="top-point-context"><RiskBadge level={point.nivel_riesgo} /><span>{point.total_siniestros} siniestros</span><span>Fichas: {inspectionCounts ? inspectionCounts.get(point.id_punto) ?? 0 : "No disponible"}</span></span>
                </span>
                <span className="top-point-index">{formatRiskIndex(point.indice_prioridad)}<span>/ 100</span></span>
              </button>
              <Link href={pointDetailHref(point.id_punto, { returnTo: routes.summary })} className="point-detail-action top-point-detail-link" aria-label={`Ver detalle técnico de ${point.nombre_interseccion}`} title={`Ver detalle técnico de ${point.nombre_interseccion}`}><span aria-hidden="true">→</span></Link>
            </li>)}
          </ul> : <QueryState state="empty" icon="map" title="No hay puntos en la respuesta" description="El servicio no entregó puntos para esta selección." />}
          <p className="panel-footer">Capa pública general, sin filtro temporal. Las cantidades de fichas incluyen todas las inspecciones registradas.</p>
        </>
      )}
    </section>
  );
}
