"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { parseRankingSearch } from "../../config/ranking-filters";
import { parsePointId, safeRankingReturnTo } from "../../config/routes";
import { useRiskPoints } from "../../hooks/useRiskPoints";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";
import { PublicPointList } from "./PublicPointList";
import { RiskLegend } from "./RiskLegend";
import { RiskMap } from "./RiskMap";

export function PublicRiskExplorer() {
  const { points, status, error, refetch } = useRiskPoints();
  const search = useSearchParams();
  const requestedIds = search.getAll("punto");
  const requestKey = JSON.stringify(requestedIds);
  const requestedId = requestedIds.length === 1 ? parsePointId(requestedIds[0]) : null;
  const returns = search.getAll("returnTo");
  const returnTo = returns.length ? safeRankingReturnTo(returns.length === 1 ? returns[0] : undefined) : null;
  const returnQuery = returnTo ? parseRankingSearch(new URL(returnTo, "https://alervi.local").searchParams).query : null;
  const returnContextId = useId();
  const [selection, setSelection] = useState({ requestKey, id: requestedId, revision: 0 });
  // Una nueva navegación reinicia la selección local, también con Atrás/Adelante.
  if (selection.requestKey !== requestKey) {
    setSelection({ requestKey, id: requestedId, revision: selection.revision + 1 });
  }
  const selected = status === "success" ? points.find((point) => point.id_punto === selection.id) ?? null : null;
  const unavailable = status === "success" && requestedIds.length > 0 &&
    (requestedId === null || !points.some((point) => point.id_punto === requestedId));

  function selectPoint(id: number) {
    if (!points.some((point) => point.id_punto === id)) return;
    setSelection((previous) => ({ requestKey, id: previous.id === id ? null : id, revision: previous.revision + 1 }));
  }

  return (
    <>
      {returnTo && <nav className="public-map-return" aria-label="Regreso al ranking">
        <Link href={returnTo} className="button-primary public-map-return__link" aria-describedby={returnQuery ? returnContextId : undefined}>
          <span aria-hidden="true">←</span> Volver al ranking
        </Link>
        {returnQuery && <p id={returnContextId} className="public-map-return__context">
          <span>Consulta del ranking</span>
          <strong>{returnQuery.anio ?? `${returnQuery.periodo_inicio}–${returnQuery.periodo_fin}`} · Top {returnQuery.limit}</strong>
        </p>}
      </nav>}
      <div className="public-map-context">
        <p><Icon name="layers" size={17} /> Capa pública general · Concepción</p>
        <p>Esta capa no aplica filtros de año o de ranking.</p>
        <button type="button" className="button-secondary" onClick={refetch} disabled={status === "loading"}>Actualizar puntos</button>
      </div>
      <RiskLegend />
      {unavailable && <div className="surface-card public-query-panel" role="status">
        <QueryState state="empty" icon="point" title="Punto no disponible en el mapa público" description="El identificador solicitado no aparece en los datos públicos recibidos. Puedes explorar los puntos disponibles o regresar al ranking." />
      </div>}
      {status === "loading" ? (
        <div className="surface-card public-query-panel"><QueryState state="loading" title="Consultando puntos públicos" description="Obteniendo la capa comunal de Concepción." /></div>
      ) : status === "error" ? (
        <div className="surface-card public-query-panel"><QueryState state="error" title="No se pudieron cargar los puntos" description={error ?? "La consulta no pudo completarse."} onRetry={refetch} /></div>
      ) : (
        <div className="public-map-grid">
          <section className="surface-card public-map-panel" aria-labelledby="titulo-mapa-publico">
            <div className="panel-header">
              <div><h2 id="titulo-mapa-publico">Mapa de puntos críticos</h2><p>Ubicación y antecedentes públicos</p></div>
              <a href="#lista-puntos-publicos" className="inline-link">Ir a la lista</a>
            </div>
            <RiskMap points={points} selectedId={selected?.id_punto ?? null} selectionRevision={selection.revision} onSelect={selectPoint} />
          </section>
          <section id="lista-puntos-publicos" tabIndex={-1} className="surface-card public-list-panel" aria-labelledby="titulo-lista-publica">
            <div className="panel-header"><div><h2 id="titulo-lista-publica">Lista de puntos</h2><p>{points.length} puntos recibidos · mismo ámbito que el mapa</p></div></div>
            <p className="sr-only" role="status">{selected ? `Seleccionado: ${selected.nombre_interseccion}. Vuelve a pulsarlo para deseleccionarlo.` : "Sin punto seleccionado. Puedes elegir uno desde el mapa o con el teclado en la lista."}</p>
            {points.length ? <PublicPointList points={points} selectedId={selected?.id_punto ?? null} onSelect={selectPoint} />
              : <QueryState state="empty" icon="map" title="No hay puntos en la respuesta" description="El servicio no entregó puntos para Concepción en esta consulta. Esto no permite afirmar que las vías sean seguras ni que no exista riesgo." />}
          </section>
        </div>
      )}
    </>
  );
}
