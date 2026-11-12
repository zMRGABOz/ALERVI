"use client";

import { useId } from "react";
import type { RankedPoint } from "../../services/ranking";
import { QueryState } from "../UI/QueryState";
import { RiskBadge } from "../UI/RiskBadge";

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const countFormatter = new Intl.NumberFormat("es-CL");

type RankingTableProps = {
  points: readonly RankedPoint[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function RankingTable({ points, selectedId, onSelect }: RankingTableProps) {
  const helpId = useId();

  if (!points.length) {
    return <QueryState state="empty" icon="ranking" title="No hay puntos con índice en esta respuesta" description="El servicio no entregó prioridades calculadas para esta consulta. Esto no permite concluir que no exista riesgo vial." />;
  }

  return (
    <>
      <p id={helpId} className="ranking-table-help">Selecciona una intersección con el teclado o el cursor. En pantallas pequeñas, desplaza la tabla horizontalmente para ver todos los conteos.</p>
      <div className="ranking-table-scroll" role="region" aria-label="Tabla de prioridades" aria-describedby={helpId} tabIndex={0}>
        <table className="ranking-table">
          <caption className="sr-only">Posiciones, índices y orden entregados por el servicio, sin recalcular empates.</caption>
          <thead>
            <tr>
              <th scope="col">Posición</th>
              <th scope="col">Intersección</th>
              <th scope="col" className="ranking-number">IP / 100</th>
              <th scope="col">Nivel</th>
              <th scope="col" className="ranking-number">Siniestros</th>
              <th scope="col" className="ranking-number">Fallecidos</th>
              <th scope="col" className="ranking-number">Graves</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => {
              const selected = point.id_punto === selectedId;
              return (
                <tr key={point.id_punto} data-selected={selected}>
                  <td className="ranking-position">{point.posicion_ranking}</td>
                  <th scope="row">
                    <button type="button" className="ranking-point-select" aria-pressed={selected} onClick={() => onSelect(point.id_punto)}>
                      {point.nombre_interseccion}
                    </button>
                  </th>
                  <td className="ranking-number ranking-index">{indexFormatter.format(point.indice_prioridad)}</td>
                  <td><RiskBadge level={point.nivel_riesgo} /></td>
                  <td className="ranking-number">{countFormatter.format(point.total_siniestros)}</td>
                  <td className="ranking-number">{countFormatter.format(point.total_fallecidos)}</td>
                  <td className="ranking-number">{countFormatter.format(point.total_graves)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
