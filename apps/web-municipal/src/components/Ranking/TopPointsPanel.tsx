"use client";

import Link from "next/link";
import { initialRankingQuery } from "../../config/ranking";
import { riskLevels } from "../../config/risk-levels";
import { pointDetailHref, routes } from "../../config/routes";
import type { useRanking } from "../../hooks/useRanking";
import { QueryState } from "../UI/QueryState";
import { RiskBadge } from "../UI/RiskBadge";
import { RankingErrorState } from "./RankingErrorState";

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago",
});

type TopPointsPanelProps = {
  query: ReturnType<typeof useRanking>;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function TopPointsPanel({ query, selectedId, onSelect }: TopPointsPanelProps) {
  return (
    <section className="surface-card top-points-panel" aria-labelledby="titulo-panel-prioridades">
      <div className="panel-header">
        <div>
          <h2 id="titulo-panel-prioridades">Zonas prioritarias</h2>
          <p>{query.data
            ? `${query.data.puntos.length} prioridades recibidas · Top ${initialRankingQuery.limit} solicitado`
            : query.status === "loading" ? "Consultando prioridades municipales" : "Ranking no disponible"}</p>
        </div>
        <Link href={routes.ranking} className="inline-link">Ver ranking</Link>
      </div>
      {query.status === "loading" ? (
        <div className="summary-ranking-placeholder"><QueryState state="loading" title="Consultando prioridades" description="Las tarjetas y este panel comparten la misma respuesta de ranking." /></div>
      ) : query.status !== "success" ? (
        <div className="ranking-state-panel"><RankingErrorState error={query.error} onRetry={query.refetch} /></div>
      ) : (
        <>
          {query.data.puntos.length ? (
            <ul className="top-point-list" aria-label="Prioridades del ranking municipal">
              {query.data.puntos.map((point) => (
                <li key={point.id_punto} className="top-point-card" data-selected={point.id_punto === selectedId}>
                  <button
                    type="button"
                    className="top-point-button"
                    aria-pressed={point.id_punto === selectedId}
                    aria-label={`Ubicar ${point.nombre_interseccion} en el mapa. Posición ${point.posicion_ranking}. IP ${indexFormatter.format(point.indice_prioridad)}. Nivel ${riskLevels[point.nivel_riesgo].label}.`}
                    onClick={() => onSelect(point.id_punto)}
                  >
                    <span className="top-point-position">{point.posicion_ranking}</span>
                    <span className="top-point-content">
                      <span className="top-point-name">{point.nombre_interseccion}</span>
                      <span className="top-point-context"><RiskBadge level={point.nivel_riesgo} /><span>{point.total_siniestros} siniestros</span></span>
                    </span>
                    <span className="top-point-index">{indexFormatter.format(point.indice_prioridad)}<span>/ 100</span></span>
                  </button>
                  <Link href={pointDetailHref(point.id_punto, { returnTo: routes.summary, rankingPeriod: query.data.periodo, rankingVersion: query.data.configuracion_version })} className="point-detail-action top-point-detail-link" aria-label={`Ver detalle técnico de ${point.nombre_interseccion}`} title={`Ver detalle técnico de ${point.nombre_interseccion}`}><span aria-hidden="true">→</span></Link>
                </li>
              ))}
            </ul>
          ) : <QueryState state="empty" icon="ranking" title="Sin prioridades calculadas en esta respuesta" description="El servicio no entregó puntos con índice para esta consulta. Esto no permite afirmar que no exista riesgo vial." />}
          {query.data.puntos_sin_indice.length > 0 && (
            <div className="top-unscored-context">
              <RiskBadge level={null} />
              <p>{query.data.puntos_sin_indice.length} {query.data.puntos_sin_indice.length === 1 ? "punto sin índice recibido" : "puntos sin índice recibidos"}. Consulta sus motivos en el ranking.</p>
            </div>
          )}
          <p className="panel-footer">Cálculo: <time dateTime={query.data.fecha_calculo}>{dateFormatter.format(new Date(query.data.fecha_calculo))}</time> (Chile)</p>
        </>
      )}
    </section>
  );
}
