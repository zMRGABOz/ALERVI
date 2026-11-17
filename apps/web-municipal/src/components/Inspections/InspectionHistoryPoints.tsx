"use client";

import { useId, useState } from "react";
import type { InspectionChoice } from "../../integrations/inspection-module";
import type { ApiError } from "../../services/api";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";

export type InspectionHistoryPoint = InspectionChoice & { count: number };

type InspectionHistoryPointsProps = {
  points: readonly InspectionHistoryPoint[];
  selectedId: number | null;
  loading: boolean;
  refreshing: boolean;
  error: ApiError | null;
  onRefresh: () => void;
  onSelect: (point: InspectionHistoryPoint) => void;
};

const PAGE_SIZE = 10;
const countFormatter = new Intl.NumberFormat("es-CL");

export function InspectionHistoryPoints({ points, selectedId, loading, refreshing, error, onRefresh, onSelect }: InspectionHistoryPointsProps) {
  const titleId = useId();
  const [requestedPage, setRequestedPage] = useState(0);
  const pages = Math.max(1, Math.ceil(points.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages - 1);
  const offset = page * PAGE_SIZE;
  const visible = points.slice(offset, offset + PAGE_SIZE);
  const total = points.reduce((sum, point) => sum + point.count, 0);

  return (
    <section className="surface-card inspection-history-points" aria-labelledby={titleId}>
      <div className="inspection-history-points__heading">
        <div>
          <h2 id={titleId}>Puntos con fichas</h2>
          <p>{loading ? "Consultando las inspecciones registradas…" : error ? "El conteo no está disponible." : `${countFormatter.format(points.length)} ${points.length === 1 ? "punto" : "puntos"} · ${countFormatter.format(total)} ${total === 1 ? "ficha registrada" : "fichas registradas"}`}</p>
        </div>
        <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading || refreshing}>{refreshing ? "Actualizando fichas…" : "Actualizar fichas"}</button>
      </div>
      {loading ? <QueryState state="loading" title="Consultando puntos con fichas" description="Obteniendo la cantidad de inspecciones de cada punto." />
        : error ? <QueryState state="error" title="No se pudieron consultar los puntos con fichas" description={error.message} onRetry={error.status === 401 || error.status === 403 ? undefined : onRefresh} />
          : !points.length ? <QueryState state="empty" icon="inspection" title="Aún no hay puntos con fichas" description="Los puntos aparecerán aquí cuando tengan una inspección registrada. Puedes usar el buscador para elegir un punto." />
            : <>
              <p className="inspection-history-points__help">Ordenados de mayor a menor cantidad de fichas. Selecciona un punto para abrir su historial.</p>
              <ol className="inspection-history-points__list" start={offset + 1}>
                {visible.map((point) => <li key={point.id}>
                  <button
                    type="button"
                    className="inspection-history-points__point"
                    aria-current={point.id === selectedId ? "true" : undefined}
                    aria-controls="inspection-content"
                    aria-label={`Ver historial de ${point.name} (punto #${point.id}, ${point.count} ${point.count === 1 ? "ficha" : "fichas"})`}
                    onClick={() => onSelect(point)}
                  >
                    <span className="inspection-history-points__identity"><span>{point.name}</span><span>Punto #{point.id}{point.id === selectedId ? " · En uso" : ""}</span></span>
                    <span className="inspection-history-points__action"><strong>{countFormatter.format(point.count)} {point.count === 1 ? "ficha" : "fichas"}</strong><Icon name="history" size={18} /></span>
                  </button>
                </li>)}
              </ol>
              {pages > 1 && <nav className="inspection-history-points__pagination" aria-label="Páginas de puntos con fichas">
                <p role="status">Mostrando {countFormatter.format(offset + 1)}–{countFormatter.format(offset + visible.length)} de {countFormatter.format(points.length)}</p>
                <div>
                  <button type="button" className="button-secondary" onClick={() => setRequestedPage(page - 1)} disabled={page === 0}>Anterior</button>
                  <button type="button" className="button-secondary" onClick={() => setRequestedPage(page + 1)} disabled={page === pages - 1}>Siguiente</button>
                </div>
              </nav>}
            </>}
    </section>
  );
}
