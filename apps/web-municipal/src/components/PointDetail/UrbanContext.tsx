import type { UrbanData, UrbanElement } from "../../services/point-detail-response";
import { QueryState } from "../UI/QueryState";
import { formatDetailValue } from "./format";

function NearbyElement({ element, label }: { element: UrbanElement | null; label: string }) {
  return (
    <div className="point-nearby-element">
      <h3>{label}</h3>
      <p>{element?.nombre ?? "Elemento cercano no informado"}</p>
      <p className="text-muted">{element?.distancia_m !== null && element?.distancia_m !== undefined ? `Distancia informada: ${formatDetailValue(element.distancia_m)} m` : "Distancia no informada"}</p>
    </div>
  );
}

export function UrbanContext({ urban }: { urban: UrbanData | null }) {
  return (
    <section className="surface-card point-detail-section" aria-labelledby="titulo-entorno">
      <div className="panel-header"><div><h2 id="titulo-entorno">Entorno urbano informado</h2><p>Conteos y distancias proporcionados por el servicio</p></div></div>
      {urban ? (
        <div className="point-section-body">
          <dl className="point-detail-metadata">
            <div><dt>Radio de consulta</dt><dd>{urban.buffer_metros === null ? "No informado" : `${formatDetailValue(urban.buffer_metros)} m`}</dd></div>
            <div><dt>Colegios en el radio</dt><dd>{formatDetailValue(urban.total_colegios_buffer)}</dd></div>
            <div><dt>Paraderos en el radio</dt><dd>{formatDetailValue(urban.total_paraderos_buffer)}</dd></div>
          </dl>
          <div className="point-nearby-grid">
            <NearbyElement label="Colegio más cercano informado" element={urban.colegio_mas_cercano} />
            <NearbyElement label="Paradero más cercano informado" element={urban.paradero_mas_cercano} />
          </div>
        </div>
      ) : <QueryState state="empty" icon="map" title="Entorno urbano no informado" description="La respuesta no permite identificar un radio de consulta, elementos cercanos o sus distancias." />}
    </section>
  );
}
