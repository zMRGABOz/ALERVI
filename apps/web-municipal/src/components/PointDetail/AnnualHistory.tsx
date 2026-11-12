import type { AnnualRecord } from "../../services/point-detail-response";
import { QueryState } from "../UI/QueryState";
import { formatDetailValue } from "./format";

export function AnnualHistory({ rows }: { rows: readonly AnnualRecord[] | null }) {
  return (
    <section className="surface-card point-detail-section" aria-labelledby="titulo-historico">
      <div className="panel-header"><div><h2 id="titulo-historico">Histórico anual informado</h2><p>Registros recibidos para este punto</p></div></div>
      {rows?.length ? (
        <>
          <p className="detail-table-help" id="ayuda-historico">Se muestran únicamente los años recibidos. Un año ausente no equivale a cero siniestros y esta serie no confirma el período utilizado para calcular el IP.</p>
          <div className="detail-table-scroll" role="region" aria-label="Tabla de antecedentes anuales" aria-describedby="ayuda-historico" tabIndex={0}>
            <table className="detail-table annual-history-table">
              <caption className="sr-only">Conteos anuales informados por el servicio, ordenados por año. No se completan años ausentes.</caption>
              <thead><tr><th scope="col">Año</th><th scope="col" className="detail-number">Siniestros</th><th scope="col" className="detail-number">Fallecidos</th><th scope="col" className="detail-number">Graves</th><th scope="col" className="detail-number">Menos graves</th><th scope="col" className="detail-number">Leves</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.anio}>
                  <th scope="row">{row.anio}</th>
                  <td className="detail-number">{formatDetailValue(row.cantidad_siniestros)}</td>
                  <td className="detail-number">{formatDetailValue(row.fallecidos)}</td>
                  <td className="detail-number">{formatDetailValue(row.graves)}</td>
                  <td className="detail-number">{formatDetailValue(row.menos_graves)}</td>
                  <td className="detail-number">{formatDetailValue(row.leves)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : <QueryState state="empty" icon="calendar" title={rows === null ? "Histórico no informado" : "Sin registros anuales en esta respuesta"} description="No hay una serie anual disponible para mostrar. Esto no permite concluir que no hayan ocurrido siniestros." />}
    </section>
  );
}
