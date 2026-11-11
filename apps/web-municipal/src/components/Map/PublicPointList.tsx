"use client";

import { Icon } from "../UI/Icon";
import { RiskBadge } from "../UI/RiskBadge";
import { formatRiskIndex, type PublicRiskPoint } from "./public-points";

export function PublicPointList({
  points,
  selectedId,
  onSelect,
}: {
  points: readonly PublicRiskPoint[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="public-point-list" aria-label="Puntos públicos de Concepción">
      {points.map((point) => {
        const selected = point.id_punto === selectedId;
        return (
          <li key={point.id_punto} className="public-point-card" data-selected={selected}>
            <h3>
              <button
                type="button"
                className="public-point-select"
                aria-pressed={selected}
                aria-label={`Seleccionar ${point.nombre_interseccion} en el mapa`}
                onClick={() => onSelect(point.id_punto)}
              >
                <Icon name="point" size={18} />
                <span>{point.nombre_interseccion}</span>
              </button>
            </h3>
            <div className="public-point-card__priority">
              <RiskBadge level={point.nivel_riesgo} />
              <span>IP <strong>{formatRiskIndex(point.indice_prioridad)}</strong>/100</span>
              {selected && <span className="public-point-card__selected">Seleccionado</span>}
            </div>
            <dl className="public-point-counts">
              <div><dt>Siniestros</dt><dd>{point.total_siniestros}</dd></div>
              <div><dt>Fallecidos</dt><dd>{point.total_fallecidos ?? "No informado"}</dd></div>
              <div><dt>Graves</dt><dd>{point.total_graves ?? "No informado"}</dd></div>
            </dl>
            {point.resumen_publico && <p className="public-point-card__summary">{point.resumen_publico}</p>}
          </li>
        );
      })}
    </ul>
  );
}
