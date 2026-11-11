import { initialRankingQuery } from "../../config/ranking";
import type { useRanking } from "../../hooks/useRanking";
import { Icon } from "../UI/Icon";
import { MetricCard } from "../UI/MetricCard";

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

export function DashboardMetrics({ query }: { query: ReturnType<typeof useRanking> }) {
  const data = query.data;
  const firstPriority = data?.puntos[0];
  const loading = query.status === "loading";

  return (
    <section className="summary-metrics" aria-label="Métricas del resumen municipal">
      <MetricCard
        label="Prioridades recibidas"
        value={data ? data.puntos.length : loading ? "Consultando…" : null}
        description={`Puntos con índice en esta respuesta. Máximo solicitado: ${initialRankingQuery.limit}.`}
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
        value={null}
        description="El servicio no entrega un total global de inspecciones."
        icon={<Icon name="inspection" />}
      />
    </section>
  );
}
