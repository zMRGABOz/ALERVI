"use client";

import Link from "next/link";
import { useState } from "react";
import { initialRankingQuery } from "../../config/ranking";
import { routes } from "../../config/routes";
import { useRanking } from "../../hooks/useRanking";
import { useSession } from "../../hooks/useSession";
import type { ApiError } from "../../services/api";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";
import { RankingMetadata } from "./RankingMetadata";
import { RankingTable } from "./RankingTable";
import { UnscoredPoints } from "./UnscoredPoints";

function RankingFailure({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const { source, logout } = useSession();
  const unauthorized = error.status === 401;
  const forbidden = error.status === 403;
  const accessError = unauthorized || forbidden;
  const title = unauthorized ? "Sesión no válida" : forbidden ? "Sin permiso para consultar el ranking" : "No se pudo cargar el ranking";
  const description = unauthorized
    ? source === "demo"
      ? "La consulta rechazó el perfil local. Puedes restablecer la sesión de demostración para volver a consultar."
      : "La sesión no es válida o expiró. Cierra la sesión y vuelve a autenticarte."
    : forbidden
      ? "El servicio no autoriza esta consulta con el perfil actual. Utiliza un perfil municipal con permiso de acceso."
      : error.message;

  return (
    <div className="surface-card ranking-state-panel">
      <QueryState state="error" title={title} description={description} onRetry={accessError ? undefined : onRetry} />
      {accessError && (
        <div className="ranking-access-actions">
          {unauthorized && (source === "demo"
            ? <button type="button" className="button-primary" onClick={() => window.location.reload()}>Restablecer sesión local</button>
            : <button type="button" className="button-primary" onClick={logout}>Cerrar sesión</button>)}
          <Link href={routes.map} className="button-secondary">Ir al mapa público</Link>
        </div>
      )}
    </div>
  );
}

export function RankingView() {
  const query = useRanking();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = query.data?.puntos.find((point) => point.id_punto === selectedId) ?? null;
  const accessError = query.status === "unauthenticated" || query.status === "forbidden";

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
      ) : query.status !== "success" ? <RankingFailure error={query.error} onRetry={query.refetch} /> : (
        <>
          <RankingMetadata ranking={query.data} />
          <section className="surface-card ranking-results" aria-labelledby="titulo-ranking">
            <div className="panel-header">
              <div><h2 id="titulo-ranking">Top {initialRankingQuery.limit} comunal</h2><p>{query.data.puntos.length} puntos con índice recibidos · máximo solicitado: {initialRankingQuery.limit}</p></div>
              <span className="status-badge"><Icon name="ranking" size={14} /> Prioridad relativa</span>
            </div>
            <RankingTable points={query.data.puntos} selectedId={selected?.id_punto ?? null} onSelect={setSelectedId} />
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
