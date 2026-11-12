"use client";

import { useState } from "react";
import { useRiskPoints } from "../../hooks/useRiskPoints";
import { Icon } from "../UI/Icon";
import { QueryState } from "../UI/QueryState";
import { PublicPointList } from "./PublicPointList";
import { RiskLegend } from "./RiskLegend";
import { RiskMap } from "./RiskMap";

export function PublicRiskExplorer() {
  const { points, status, error, refetch } = useRiskPoints();
  const [selection, setSelection] = useState<{ id: number | null; revision: number }>({ id: null, revision: 0 });
  const selected = points.find((point) => point.id_punto === selection.id) ?? null;

  function selectPoint(id: number) {
    setSelection((previous) => ({ id: previous.id === id ? null : id, revision: previous.revision + 1 }));
  }

  return (
    <>
      <div className="public-map-context">
        <p><Icon name="layers" size={17} /> Capa pública general · Concepción</p>
        <p>Esta capa no aplica filtros de año o de ranking.</p>
        <button type="button" className="button-secondary" onClick={refetch} disabled={status === "loading"}>Actualizar puntos</button>
      </div>
      <RiskLegend />
      {status === "loading" ? (
        <div className="surface-card public-query-panel"><QueryState state="loading" title="Consultando puntos públicos" description="Obteniendo la capa comunal de Concepción." /></div>
      ) : status === "error" ? (
        <div className="surface-card public-query-panel"><QueryState state="error" title="No se pudieron cargar los puntos" description={error ?? "La consulta no pudo completarse."} onRetry={refetch} /></div>
      ) : points.length === 0 ? (
        <div className="surface-card public-query-panel"><QueryState state="empty" icon="map" title="No hay puntos en la respuesta" description="El servicio no entregó puntos para Concepción en esta consulta. Esto no permite afirmar que las vías sean seguras ni que no exista riesgo." /></div>
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
            <p className="public-selection-status" role="status">{selected ? `Seleccionado: ${selected.nombre_interseccion}. Vuelve a pulsarlo para deseleccionarlo.` : "Sin punto seleccionado. Puedes elegir uno desde el mapa o con el teclado en la lista."}</p>
            <PublicPointList points={points} selectedId={selected?.id_punto ?? null} onSelect={selectPoint} />
          </section>
        </div>
      )}
    </>
  );
}
