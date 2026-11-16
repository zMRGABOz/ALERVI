import type { useInspectionSummary } from "../../hooks/useInspectionSummary";
import type { useRanking } from "../../hooks/useRanking";
import { Icon } from "../UI/Icon";
import { MetricCard } from "../UI/MetricCard";

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

export function DashboardMetrics({ query, inspections, displayedPointCount, pointsLoading, pointsError }: {
  query: ReturnType<typeof useRanking>;
  inspections: ReturnType<typeof useInspectionSummary>;
  displayedPointCount: number | null;
  pointsLoading: boolean;
  pointsError: string | null;
}) {
  const data = query.data;
  const firstPriority = data?.puntos[0];
  const loading = query.status === "loading";

  return (
    <section className="summary-metrics" aria-label="Métricas del resumen municipal">
      <MetricCard
        label="Puntos desplegados"
        value={pointsLoading ? "Consultando…" : displayedPointCount?.toLocaleString("es-CL") ?? null}
        description={pointsError ?? "Cantidad de puntos mostrados en el mapa del resumen."}
        icon={<Icon name="point" />}
      />
      <MetricCard
        label="Mayor IP"
        value={loading ? "Consultando…" : firstPriority ? `${indexFormatter.format(firstPriority.indice_prioridad)} / 100` : null}
        description={firstPriority ? "IP de la primera posición recibida." : "Requiere al menos una prioridad calculada."}
        icon={<Icon name="ranking" />}
      />
      <MetricCard
        label="Período del ranking"
        value={loading ? "Consultando…" : data?.periodo ?? null}
        description={data ? `Configuración del cálculo: ${data.configuracion_version}.` : "Se muestra el período informado por el servicio."}
        icon={<Icon name="calendar" />}
      />
      <MetricCard
        label="Inspecciones registradas"
        value={inspections.data ? inspections.data.total_fichas_inspeccion : inspections.status === "loading" ? "Consultando…" : null}
        description={inspections.error ? `${inspections.error.message} Usa Actualizar resumen para reintentar.` : "Total de fichas registradas, sin filtros del ranking."}
        icon={<Icon name="inspection" />}
      />
    </section>
  );
}
