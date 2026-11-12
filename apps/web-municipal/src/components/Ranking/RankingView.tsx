"use client";

import { useState } from "react";
import { initialRankingQuery } from "../../config/ranking";
import { useRanking } from "../../hooks/useRanking";
import { useRankingFilters } from "../../hooks/useRankingFilters";
import { RankingFilters } from "../Filters/RankingFilters";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";
import { RankingErrorState } from "./RankingErrorState";
import { RankingMetadata } from "./RankingMetadata";
import { RankingTable } from "./RankingTable";
import { UnscoredPoints } from "./UnscoredPoints";

export function RankingView() {
  const filters = useRankingFilters();
  const query = useRanking(filters.query);
  const [selection, setSelection] = useState<{ id: number | null; queryKey: string } | null>(null);
  const selected = selection?.queryKey === query.queryKey ? query.data?.puntos.find((point) => point.id_punto === selection.id) ?? null : null;
  const accessError = query.status === "unauthenticated" || query.status === "forbidden";
  const limit = filters.query?.limit ?? initialRankingQuery.limit;
  const offset = filters.query?.offset ?? 0;

  function togglePoint(id: number) {
    setSelection((previous) => ({ id: previous?.queryKey === query.queryKey && previous.id === id ? null : id, queryKey: query.queryKey }));
  }

  return (
    <div className="ranking-page">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Consulta municipal · {initialRankingQuery.comuna}</p>
          <h1>Ranking de prioridades</h1>
          <p className="summary-heading__description">Prioridades comunales en el orden y con las posiciones entregadas por el servicio.</p>
        </div>
        {!accessError && <button type="button" className="button-secondary" onClick={query.refetch} disabled={!filters.query || query.status === "loading"}>Actualizar ranking</button>}
      </div>
      <RankingFilters key={filters.formKey} initialFields={filters.fields} urlErrors={filters.errors} onApply={filters.apply} onReset={filters.reset} />
      {!filters.query ? (
        <div className="surface-card ranking-state-panel"><QueryState state="empty" icon="ranking" title="Consulta pendiente de corregir filtros" description="Los parámetros no válidos no se enviaron al servicio. Corrige o restablece los filtros para consultar." /></div>
      ) : query.status === "loading" ? (
        <div className="surface-card ranking-state-panel"><QueryState state="loading" title="Consultando ranking" description={`Solicitando hasta ${limit} prioridades para ${initialRankingQuery.comuna}.`} /></div>
      ) : query.status === "error" && query.error.code === "PERIODO_SIN_COBERTURA" ? (
        <div className="surface-card ranking-state-panel"><QueryState state="empty" icon="ranking" title="Período sin cobertura" description={query.error.message} /></div>
      ) : query.status !== "success" ? (
        <div className="surface-card ranking-state-panel"><RankingErrorState error={query.error} onRetry={query.refetch} /></div>
      ) : (
        <>
          <RankingMetadata ranking={query.data} />
          <section className="surface-card ranking-results" aria-labelledby="titulo-ranking">
            <div className="panel-header">
              <div><h2 id="titulo-ranking">{offset ? "Resultados comunales" : `Top ${limit} comunal`}</h2><p>{query.data.puntos.length} puntos con índice recibidos · máximo solicitado: {limit}{offset ? ` · desplazamiento solicitado: ${offset}` : ""}</p></div>
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
