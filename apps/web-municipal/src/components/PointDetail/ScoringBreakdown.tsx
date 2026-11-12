import { scoringFactors, scoringIssues, type PointDetail } from "../../services/point-detail-response";
import { QueryState } from "../UI/QueryState";
import { formatDetailValue } from "./format";

export function ScoringBreakdown({ detail }: { detail: PointDetail }) {
  const scoring = detail.estado_indice === "SIN_INDICE_DISPONIBLE" ? null : detail.desglose_scoring;
  const issues = scoringIssues(detail);

  return (
    <section className="surface-card point-detail-section" aria-labelledby="titulo-desglose">
      <div className="panel-header"><div><h2 id="titulo-desglose">Desglose del índice</h2><p>Pesos asociados al detalle · versión {detail.configuracion_pesos_version ?? "no informada"}</p></div></div>
      {issues.length > 0 && (
        <div className="detail-notice detail-notice--error" role="alert">
          <h3>Inconsistencia en el desglose recibido</h3>
          <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          <p>Se conservan los valores del servicio. La comprobación admite una diferencia de hasta 0,1 puntos por redondeo y de 0,0001 en la suma de pesos.</p>
        </div>
      )}
      {scoring ? (
        <>
          <p className="detail-table-help" id="ayuda-desglose">Valores normalizados entre 0 y 100; pesos como fracciones entre 0 y 1; aportes expresados en puntos del IP. Los campos ausentes se indican como no informados.</p>
          {scoring.formula && <p className="point-formula">Fórmula informada: <code>{scoring.formula}</code></p>}
          <div className="detail-table-scroll" role="region" aria-label="Tabla del desglose del índice" aria-describedby="ayuda-desglose" tabIndex={0}>
            <table className="detail-table scoring-table">
              <caption className="sr-only">Componentes, pesos y aportes recibidos con el detalle; IP informado: {formatDetailValue(detail.indice_prioridad)}.</caption>
              <thead><tr><th scope="col">Componente</th><th scope="col" className="detail-number">Valor / 100</th><th scope="col" className="detail-number">Peso [0–1]</th><th scope="col" className="detail-number">Aporte al IP</th></tr></thead>
              <tbody>{scoringFactors.map((factor) => (
                <tr key={factor.symbol}>
                  <th scope="row">{factor.label} <span className="text-muted">({factor.symbol})</span></th>
                  <td className="detail-number">{formatDetailValue(scoring[factor.value])}</td>
                  <td className="detail-number">{formatDetailValue(scoring[factor.weight])}</td>
                  <td className="detail-number">{formatDetailValue(scoring[factor.contribution])}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : <QueryState state="empty" icon="ranking" title="Desglose no disponible" description="La respuesta no incluye un desglose calculado para este punto." />}
    </section>
  );
}
