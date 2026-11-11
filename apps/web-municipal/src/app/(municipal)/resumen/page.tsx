import type { Metadata } from "next";
import { env, type ApiMode } from "../../../config/env";
import { Icon } from "../../../components/UI/Icon";
import { MetricCard } from "../../../components/UI/MetricCard";
import { QueryState } from "../../../components/UI/QueryState";

export const metadata: Metadata = { title: "Resumen municipal · ALERVI" };

const dataModes: Record<ApiMode, { label: string; description: string }> = {
  mock: { label: "Demostración local", description: "Fixtures sintéticos identificados." },
  "api-stub": { label: "API de demostración", description: "Conexión HTTP a un servidor de prueba." },
  api: { label: "API", description: "Conexión HTTP al servicio configurado." },
};

export default function SummaryPage() {
  const dataMode = dataModes[env.apiMode];

  return (
    <>
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Espacio de trabajo municipal</p>
          <h1>Resumen y mapa de criticidad</h1>
          <p className="summary-heading__description">
            Consulta territorial y apoyo a la priorización de intervenciones
            viales en la comuna de Concepción.
          </p>
        </div>
        <span className="status-badge"><Icon name="layers" size={14} /> Estructura inicial</span>
      </div>

      <section aria-label="Contexto de consulta" className="summary-metrics">
        <MetricCard label="Comuna" value="Concepción" description="Ámbito territorial de la consulta." icon={<Icon name="point" />} />
        <MetricCard label="Período propuesto" value="2020–2025" description="Cobertura por confirmar con los datos." icon={<Icon name="calendar" />} />
        <MetricCard label="Modo de datos" value={dataMode.label} description={dataMode.description} icon={<Icon name="layers" />} />
        <MetricCard label="Acceso municipal" value="Sin iniciar sesión" description="Ingreso de funcionarios en preparación." icon={<Icon name="user" />} />
      </section>

      <div className="summary-panels">
        <section className="surface-card" aria-labelledby="titulo-panel-mapa">
          <div className="panel-header">
            <div>
              <h2 id="titulo-panel-mapa">Mapa de puntos críticos</h2>
              <p>Vista territorial de Concepción</p>
            </div>
            <span className="panel-caption">Ámbito general</span>
          </div>
          <div className="summary-map-placeholder">
            <QueryState
              state="empty"
              icon="map"
              title="Mapa en preparación"
              description="Aquí se integrará la capa pública de puntos críticos, con marcadores y una lista accesible."
            />
          </div>
          <p className="panel-footer"><Icon name="info" size={16} /> Capa pública general, independiente de los filtros del ranking.</p>
        </section>

        <section className="surface-card" aria-labelledby="titulo-panel-prioridades">
          <div className="panel-header">
            <div>
              <h2 id="titulo-panel-prioridades">Zonas prioritarias</h2>
              <p>Ranking municipal del período</p>
            </div>
            <Icon name="ranking" className="text-muted shrink-0" />
          </div>
          <div className="summary-ranking-placeholder">
            <QueryState
              state="empty"
              icon="ranking"
              title="Ranking en preparación"
              description="Las prioridades mostrarán el índice, su nivel y el período informado por el servicio."
            />
          </div>
          <p className="panel-footer"><Icon name="info" size={16} /> Se conservará el orden recibido del servicio.</p>
        </section>
      </div>

      <section className="surface-card selection-guidance" aria-labelledby="titulo-seleccion">
        <span className="selection-guidance__icon"><Icon name="point" size={22} /></span>
        <div>
          <h2 id="titulo-seleccion">El análisis comienza en un punto</h2>
          <p>La selección desde el mapa o el ranking permitirá abrir el detalle técnico y acceder a las inspecciones y su historial.</p>
        </div>
      </section>
    </>
  );
}
