"use client";

import { useId } from "react";
import Link from "next/link";
import type { RankedPoint } from "../../services/ranking";
import { QueryState } from "../UI/QueryState";
import { RiskBadge } from "../UI/RiskBadge";

const indexFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const countFormatter = new Intl.NumberFormat("es-CL");

type RankingTableProps = {
  points: readonly RankedPoint[];
  detailHref: (id: number) => string;
  locationHref: (id: number) => string;
};

export function RankingTable({ points, detailHref, locationHref }: RankingTableProps) {
  const helpId = useId();

  if (!points.length) {
    return <QueryState state="empty" icon="ranking" title="No hay puntos con índice en esta respuesta" description="El servicio no entregó prioridades calculadas para esta consulta. Esto no permite concluir que no exista riesgo vial." />;
  }

  return (
    <>
      <p id={helpId} className="ranking-table-help">Consulta cada punto con «Ver detalle» o «Ver ubicación». En pantallas pequeñas, desplaza la tabla horizontalmente para ver todas las columnas.</p>
      <div className="ranking-table-scroll" role="region" aria-label="Tabla de prioridades" aria-describedby={helpId} tabIndex={0}>
        <table className="ranking-table">
          <caption className="sr-only">Posiciones, índices y orden entregados por el servicio, sin recalcular empates.</caption>
          <thead>
            <tr>
              <th scope="col">Posición</th>
              <th scope="col" className="ranking-intersection">Intersección</th>
              <th scope="col" className="ranking-number">IP / 100</th>
              <th scope="col">Nivel</th>
              <th scope="col" className="ranking-number">Siniestros</th>
              <th scope="col" className="ranking-number">Fallecidos</th>
              <th scope="col" className="ranking-number">Graves</th>
              <th scope="col" className="ranking-detail-action">Detalle</th>
              <th scope="col" className="ranking-detail-action">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.id_punto}>
                <td className="ranking-position">{point.posicion_ranking}</td>
                <th scope="row" className="ranking-intersection">{point.nombre_interseccion}</th>
                <td className="ranking-number ranking-index">{indexFormatter.format(point.indice_prioridad)}</td>
                <td><RiskBadge level={point.nivel_riesgo} /></td>
                <td className="ranking-number">{countFormatter.format(point.total_siniestros)}</td>
                <td className="ranking-number">{countFormatter.format(point.total_fallecidos)}</td>
                <td className="ranking-number">{countFormatter.format(point.total_graves)}</td>
                <td className="ranking-detail-action">
                  <Link href={detailHref(point.id_punto)} className="point-detail-action" aria-label={`Ver detalle técnico de ${point.nombre_interseccion}`}>Ver detalle <span aria-hidden="true">→</span></Link>
                </td>
                <td className="ranking-detail-action">
                  <Link href={locationHref(point.id_punto)} className="point-detail-action" aria-label={`Ver ubicación de ${point.nombre_interseccion} en el mapa público`}>Ver ubicación <span aria-hidden="true">→</span></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
