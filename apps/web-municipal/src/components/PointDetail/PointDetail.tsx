"use client";

import Link from "next/link";
import { routes, type PointNavigationContext } from "../../config/routes";
import { usePointDetail } from "../../hooks/usePointDetail";
import { useSession } from "../../hooks/useSession";
import { QueryState } from "../UI/QueryState";
import { RiskBadge } from "../UI/RiskBadge";
import { AnnualHistory } from "./AnnualHistory";
import { formatDetailValue } from "./format";
import { ScoringBreakdown } from "./ScoringBreakdown";
import { UrbanContext } from "./UrbanContext";

type DetailQuery = ReturnType<typeof usePointDetail>;

function DetailState({ query }: { query: Exclude<DetailQuery, { status: "success" }> }) {
  const { source, logout } = useSession();
  if (query.status === "loading") return <QueryState state="loading" title="Consultando detalle técnico" description="Obteniendo los antecedentes y el desglose del punto." />;
  if (query.status === "invalid-id") return <QueryState state="empty" icon="point" title="Identificador de punto no válido" description="La dirección debe contener un identificador entero positivo. Elige un punto desde el ranking o el resumen." />;
  if (query.status === "unscored") return <QueryState state="empty" icon="ranking" title="Sin índice disponible" description={query.error.message} />;
  if (query.status === "not-found") return <QueryState state="empty" icon="point" title="Punto no encontrado" description="El servicio no encontró el punto solicitado. Puedes volver a la consulta de origen para elegir otro." />;
  const accessError = query.status === "unauthenticated" || query.status === "forbidden";
  const title = query.status === "unauthenticated" ? "Sesión no válida" : query.status === "forbidden" ? "Sin permiso para consultar el detalle" : "No se pudo cargar el detalle";
  const description = query.status === "unauthenticated"
    ? source === "demo" ? "El servicio rechazó el perfil local. Puedes restablecer la sesión de demostración." : "La sesión no es válida o expiró. Vuelve a autenticarte para consultar el detalle."
    : query.status === "forbidden" ? "El servicio no autoriza esta consulta con el perfil actual." : query.error.message;

  return (
    <>
      <QueryState state="error" title={title} description={description} onRetry={accessError ? undefined : query.refetch} />
      {accessError && <div className="ranking-access-actions">
        {query.status === "unauthenticated" && (source === "demo"
          ? <button type="button" className="button-primary" onClick={() => window.location.reload()}>Restablecer sesión local</button>
          : <button type="button" className="button-primary" onClick={logout}>Cerrar sesión</button>)}
        <Link href={routes.map} className="button-secondary">Ir al mapa público</Link>
      </div>}
    </>
  );
}

export function PointDetail({ id, context }: { id: number | null; context: PointNavigationContext }) {
  const query = usePointDetail(id);
  const detail = query.data;
  const fromSummary = context.returnTo.split(/[?#]/)[0] === routes.summary;
  const accessError = query.status === "unauthenticated" || query.status === "forbidden";
  const unscored = detail?.estado_indice === "SIN_INDICE_DISPONIBLE";
  const hasIndex = detail !== null && !unscored && detail.indice_prioridad !== null;

  return (
    <div className="point-detail-page">
      <Link href={context.returnTo} className="inline-link point-back-link"><span aria-hidden="true">←</span> Volver al {fromSummary ? "resumen" : "ranking"}</Link>
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Análisis municipal · Concepción{id === null ? "" : ` · Punto #${id}`}</p>
          <h1>{detail?.nombre_interseccion ?? "Detalle técnico del punto"}</h1>
          <p className="summary-heading__description">Explicación del índice y antecedentes entregados por el servicio para este punto.</p>
        </div>
        {!accessError && id !== null && <button type="button" className="button-secondary" onClick={query.refetch} disabled={query.status === "loading"}>Actualizar detalle</button>}
      </div>
      {query.status !== "success" ? (
        <div className="surface-card ranking-state-panel"><DetailState query={query} /></div>
      ) : (
        <>
          <section className="surface-card point-overview" aria-labelledby="titulo-indice-punto">
            <div className="point-index">
              <h2 id="titulo-indice-punto">Índice de prioridad</h2>
              <p className="point-index-value">{hasIndex ? formatDetailValue(query.data.indice_prioridad) : "—"}<span>/ 100</span></p>
              {hasIndex && query.data.nivel_riesgo === null
                ? <span className="status-badge">Nivel no informado</span>
                : <RiskBadge level={hasIndex ? query.data.nivel_riesgo : null} />}
              <p>Prioridad relativa de intervención, no probabilidad individual de sufrir un siniestro.</p>
            </div>
            <dl className="point-detail-metadata">
              <div><dt>Estado informado</dt><dd>{unscored ? "Sin índice disponible" : query.data.estado_indice === "CALCULADO" ? "Calculado" : query.data.estado_indice ?? "No informado"}</dd></div>
              <div><dt>Versión asociada al detalle</dt><dd>{query.data.configuracion_pesos_version ?? "No informada"}</dd></div>
              <div><dt>Fichas de este punto</dt><dd>{formatDetailValue(query.data.total_fichas_inspeccion)}</dd></div>
              <div><dt>Coordenadas informadas (latitud, longitud)</dt><dd>{query.data.latitud !== null && query.data.longitud !== null ? `${query.data.latitud}, ${query.data.longitud}` : "No informadas"}</dd></div>
            </dl>
          </section>
          <section className="detail-notice" aria-labelledby="titulo-ambito-detalle">
            <h2 id="titulo-ambito-detalle">Período del detalle no confirmado</h2>
            <p>El endpoint técnico no recibe filtros temporales ni devuelve un período explícito del cálculo. El histórico anual no permite confirmar que este índice corresponda al período de tu ranking.</p>
            {(context.rankingPeriod || context.rankingVersion) && <p>Contexto de navegación: período del ranking {context.rankingPeriod ?? "no informado"} · versión {context.rankingVersion ?? "no informada"}.</p>}
            {context.rankingVersion && query.data.configuracion_pesos_version && context.rankingVersion !== query.data.configuracion_pesos_version && <p><strong>Versiones diferentes.</strong> El detalle informa {query.data.configuracion_pesos_version}; el contexto del ranking indica {context.rankingVersion}. Los pesos mostrados pertenecen a la respuesta de este detalle.</p>}
          </section>
          {query.data.partial && <div className="detail-notice" role="status"><h2>Antecedentes parciales</h2><p>Hay campos ausentes o no válidos en la respuesta. Se muestran como no informados; los ceros recibidos se conservan como valores distintos de la ausencia de datos.</p></div>}
          <section className="surface-card point-detail-section" aria-labelledby="titulo-explicacion">
            <div className="panel-header"><h2 id="titulo-explicacion">Explicación técnica</h2></div>
            <div className="point-section-body"><p>{query.data.explicacion_tecnica ?? "El servicio no informó una explicación técnica para este punto."}</p>{query.data.advertencia_legal && <p className="point-legal">{query.data.advertencia_legal}</p>}</div>
          </section>
          <ScoringBreakdown detail={query.data} />
          <AnnualHistory rows={query.data.historico_anual} />
          <UrbanContext urban={query.data.entorno_urbano} />
        </>
      )}
    </div>
  );
}
