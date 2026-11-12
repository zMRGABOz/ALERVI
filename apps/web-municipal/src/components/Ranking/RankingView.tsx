"use client";

import { useState } from "react";
import { initialRankingQuery } from "../../config/ranking";
import { useRanking } from "../../hooks/useRanking";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";
import { RankingErrorState } from "./RankingErrorState";
import { RankingMetadata } from "./RankingMetadata";
import { RankingTable } from "./RankingTable";
import { UnscoredPoints } from "./UnscoredPoints";

export function RankingView() {
  const query = useRanking();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = query.data?.puntos.find((point) => point.id_punto === selectedId) ?? null;
  const accessError = query.status === "unauthenticated" || query.status === "forbidden";

  function togglePoint(id: number) {
    setSelectedId((previous) => previous === id ? null : id);
  }

  return (
    <div className="ranking-page">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Consulta municipal · {initialRankingQuery.comuna}</p>
          <h1>Ranking de prioridades</h1>
          <p className="summary-heading__description">Prioridades comunales en el orden y con las posiciones entregadas por el servicio.</p>
        </div>
        {!accessError && <button type="button" className="button-secondary" onClick={query.refetch} disabled={query.status === "loading"}>Actualizar ranking</button>}
      </div>
      {query.status === "loading" ? (
        <div className="surface-card ranking-state-panel"><QueryState state="loading" title="Consultando ranking" description={`Solicitando hasta ${initialRankingQuery.limit} prioridades para ${initialRankingQuery.comuna}.`} /></div>
      ) : query.status !== "success" ? (
        <div className="surface-card ranking-state-panel"><RankingErrorState error={query.error} onRetry={query.refetch} /></div>
      ) : (
        <>
          <RankingMetadata ranking={query.data} />
          <section className="surface-card ranking-results" aria-labelledby="titulo-ranking">
            <div className="panel-header">
              <div><h2 id="titulo-ranking">Top {initialRankingQuery.limit} comunal</h2><p>{query.data.puntos.length} puntos con índice recibidos · máximo solicitado: {initialRankingQuery.limit}</p></div>
              <span className="status-badge"><Icon name="ranking" size={14} /> Prioridad relativa</span>
            </div>
            <RankingTable points={query.data.puntos} selectedId={selected?.id_punto ?? null} onSelect={togglePoint} />
            {query.data.puntos.length > 0 && (
              <p className="sr-only" role="status">{selected
                ? `Seleccionado: ${selected.nombre_interseccion}. Posición informada: ${selected.posicion_ranking}.`
                : "Sin punto seleccionado."}</p>
            )}
          </section>
          <UnscoredPoints points={query.data.puntos_sin_indice} />
        </>
      )}
    </div>
  );
}
