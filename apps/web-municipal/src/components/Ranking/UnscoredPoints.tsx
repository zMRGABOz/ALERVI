import Link from "next/link";
import type { UnscoredPoint } from "../../services/ranking";
import { RiskBadge } from "../UI/RiskBadge";

export function UnscoredPoints({ points, detailHref }: { points: readonly UnscoredPoint[]; detailHref: (id: number) => string }) {
  return (
    <section className="surface-card unscored-points" aria-labelledby="titulo-puntos-sin-indice">
      <div className="panel-header">
        <div><h2 id="titulo-puntos-sin-indice">Puntos sin índice disponible</h2><p>Antecedentes separados del ranking calculado</p></div>
        <span className="panel-caption">{points.length} {points.length === 1 ? "recibido" : "recibidos"}</span>
      </div>
      {points.length ? (
        <ul className="unscored-point-list">
          {points.map((point) => (
            <li key={point.id_punto}>
              <div className="unscored-point-heading"><h3>{point.nombre_interseccion}</h3><RiskBadge level={null} /></div>
              <p>{point.motivo}</p>
              <Link href={detailHref(point.id_punto)} className="inline-link point-detail-link" aria-label={`Consultar detalle de ${point.nombre_interseccion}`}>Consultar detalle</Link>
            </li>
          ))}
        </ul>
      ) : <p className="unscored-points-empty">La respuesta no incluye puntos sin índice.</p>}
    </section>
  );
}
