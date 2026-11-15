"use client";

import { useDashboard } from "../../hooks/useDashboard";
import { RiskLegend } from "../Map/RiskLegend";
import { RiskMap } from "../Map/RiskMap";
import { TopPointsPanel } from "../Ranking/TopPointsPanel";
import { Icon } from "../UI/Icon";
import { DashboardMetrics } from "./DashboardMetrics";

export function MunicipalDashboard() {
  const dashboard = useDashboard();
  const map = dashboard.map;

  return (
    <div className="dashboard-page">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Espacio de trabajo municipal · Concepción</p>
          <h1>Resumen y mapa de criticidad</h1>
          <p className="summary-heading__description">Prioridades del período informado y consulta territorial de Concepción.</p>
        </div>
        <button type="button" className="button-secondary" onClick={dashboard.refresh} disabled={dashboard.ranking.status === "loading" && map.status === "loading"}>Actualizar resumen</button>
      </div>
      <DashboardMetrics query={dashboard.ranking} />
      <div className="summary-panels">
        <section className="surface-card dashboard-map-panel" aria-labelledby="titulo-panel-mapa">
          <div className="panel-header">
            <div><h2 id="titulo-panel-mapa">Mapa de puntos críticos</h2><p>Capa pública general de Concepción</p></div>
            <span className="status-badge"><Icon name="map" size={14} /> Ámbito general</span>
          </div>
          <RiskLegend />
          <div className={`dashboard-map-status${map.status === "error" ? " dashboard-map-status--error" : ""}`} role={map.status === "error" ? "alert" : "status"}>
            <p>{map.status === "loading" ? "Consultando los puntos de la capa pública…" : map.status === "error" ? map.error : map.points.length
              ? `${map.points.length} puntos recibidos en la capa pública general.`
              : "La capa pública no entregó puntos en esta consulta. Esto no permite afirmar que no exista riesgo."}</p>
            {map.status === "error" && <button type="button" className="button-secondary" onClick={map.refetch}>Reintentar puntos del mapa</button>}
          </div>
          <RiskMap
            points={map.points}
            selectedId={dashboard.selectedMapId}
            selectionRevision={dashboard.selectionRevision}
            focusPoint={dashboard.focusPoint}
            onSelect={dashboard.selectMapPoint}
            ariaLabel="Mapa resumido de Concepción con datos públicos generales"
          />
          <p className="panel-footer"><Icon name="info" size={16} /> La capa pública general no aplica el período del ranking. Al elegir una prioridad se busca su ubicación en los datos públicos.</p>
          {dashboard.missingPublicLocation && <p className="dashboard-map-status" role="status">La prioridad seleccionada no está disponible en el mapa público.</p>}
          <p className="sr-only" role="status">{dashboard.selectedName ? `Seleccionado: ${dashboard.selectedName}.` : "Sin punto seleccionado."}</p>
        </section>
        <TopPointsPanel query={dashboard.ranking} selectedId={dashboard.selectedId} onSelect={dashboard.selectPriority} />
      </div>
    </div>
  );
}
