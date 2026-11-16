"use client";

import { useDashboard } from "../../hooks/useDashboard";
import { RiskLegend } from "../Map/RiskLegend";
import { RiskMap } from "../Map/RiskMap";
import { PointDisplayFilters } from "../Map/PointDisplayFilters";
import { TopPointsPanel } from "../Ranking/TopPointsPanel";
import { Icon } from "../UI/Icon";
import { DashboardMetrics } from "./DashboardMetrics";
import { FilteredPointsPanel } from "./FilteredPointsPanel";

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
        <button type="button" className="button-secondary" onClick={dashboard.refresh} disabled={dashboard.ranking.refreshing || map.refreshing || dashboard.inspections.refreshing || (dashboard.ranking.status === "loading" && map.status === "loading" && dashboard.inspections.status === "loading")}>{dashboard.ranking.refreshing || map.refreshing || dashboard.inspections.refreshing ? "Actualizando resumen…" : "Actualizar resumen"}</button>
      </div>
      <DashboardMetrics
        query={dashboard.ranking}
        inspections={dashboard.inspections}
        displayedPointCount={dashboard.displayedPointCount}
        pointsLoading={dashboard.pointsLoading}
        pointsError={dashboard.pointsError}
      />
      <PointDisplayFilters
        value={dashboard.filter}
        totalPoints={map.status === "success" ? map.points.length : null}
        onChange={dashboard.setFilter}
        allowInspections
        description="Elige cuántos puntos mostrar del total comunal, el criterio y el orden. El mapa, la lista y el contador de puntos muestran la misma selección."
      />
      <div className="summary-panels">
        <section className="surface-card dashboard-map-panel" aria-labelledby="titulo-panel-mapa">
          <div className="panel-header">
            <div><h2 id="titulo-panel-mapa">Mapa de puntos críticos</h2><p>Capa pública general de Concepción</p></div>
            <span className="status-badge"><Icon name="map" size={14} /> {dashboard.filter ? "Filtro visual aplicado" : "Prioridades del ranking"}</span>
          </div>
          <RiskLegend />
          <div className={`dashboard-map-status${dashboard.pointsError ? " dashboard-map-status--error" : ""}`} role={dashboard.pointsError ? "alert" : "status"}>
            <p>{dashboard.pointsError ?? (dashboard.pointsLoading
              ? map.status === "loading" ? "Consultando los puntos de la capa pública…"
                : dashboard.waitingForCounts ? "Consultando las cantidades de fichas para aplicar el filtro…"
                  : "Consultando las prioridades para el mapa del resumen…"
              : dashboard.visibleMapPoints.length ? `${dashboard.visibleMapPoints.length.toLocaleString("es-CL")} puntos desplegados en el mapa.`
                : "No hay puntos disponibles en el mapa para esta selección.")}</p>
            {map.status === "error" && <button type="button" className="button-secondary" onClick={map.refetch}>Reintentar puntos del mapa</button>}
            {dashboard.filterError && <button type="button" className="button-secondary" onClick={dashboard.inspections.refetch}>Reintentar conteo de fichas</button>}
          </div>
          <RiskMap
            points={dashboard.visibleMapPoints}
            selectedId={dashboard.selectedMapId}
            selectionRevision={dashboard.selectionRevision}
            focusPoint={dashboard.focusPoint}
            zoomOutOnDeselect
            onSelect={dashboard.selectMapPoint}
            ariaLabel="Mapa resumido de Concepción con datos públicos generales"
          />
          <p className="panel-footer"><Icon name="info" size={16} /> La ubicación y los antecedentes del mapa provienen de la capa pública general. La vista inicial muestra los puntos del ranking; el filtro selecciona sobre el total comunal.</p>
          {dashboard.missingPublicLocation && <p className="dashboard-map-status" role="status">La prioridad seleccionada no está disponible en el mapa público.</p>}
          {dashboard.hiddenSelection && <p className="dashboard-map-status" role="status">El punto seleccionado queda fuera de la cantidad de puntos elegida. Aumenta la cantidad, cambia el criterio o el orden, o usa Restablecer para volver a mostrarlo.</p>}
          <p className="sr-only" role="status">{dashboard.selectedName ? `Seleccionado: ${dashboard.selectedName}.` : "Sin punto seleccionado."}</p>
        </section>
        {dashboard.filter ? <FilteredPointsPanel
          map={map}
          inspections={dashboard.inspections}
          points={dashboard.visibleMapPoints}
          filter={dashboard.filter}
          inspectionCounts={dashboard.inspectionCounts}
          selectedId={dashboard.selectedMapId}
          onSelect={dashboard.selectMapPoint}
        /> : <TopPointsPanel
          query={dashboard.ranking}
          inspectionCounts={dashboard.inspectionCounts}
          selectedId={dashboard.selectedId}
          onSelect={dashboard.selectPriority}
        />}
      </div>
    </div>
  );
}
