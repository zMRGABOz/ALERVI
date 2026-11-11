import { riskLevels, unscoredRisk } from "../../config/risk-levels";

export function RiskLegend() {
  return (
    <section className="risk-legend" aria-label="Leyenda de prioridad vial">
      <h2>Niveles de prioridad</h2>
      <ul>
        {Object.entries(riskLevels).map(([key, level]) => (
          <li key={key}>
            <span className="risk-legend__dot" aria-hidden="true" style={{ backgroundColor: level.color, borderColor: level.color }} />
            {level.label}
          </li>
        ))}
        <li>
          <span className="risk-legend__dot" aria-hidden="true" style={{ borderColor: unscoredRisk.color }} />
          {unscoredRisk.label}
        </li>
      </ul>
      <p>El color y la etiqueta representan el nivel informado por el servicio. IP 0 es un valor válido, distinto de «Sin índice».</p>
    </section>
  );
}
