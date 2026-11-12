import type { RankingResponse } from "../../services/ranking";

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export function RankingMetadata({ ranking }: { ranking: RankingResponse }) {
  return (
    <section className="surface-card ranking-metadata" aria-label="Contexto del cálculo del ranking">
      <dl>
        <div><dt>Comuna</dt><dd>{ranking.comuna}</dd></div>
        <div><dt>Período informado</dt><dd>{ranking.periodo}</dd></div>
        <div><dt>Versión del cálculo</dt><dd>{ranking.configuracion_version}</dd></div>
        <div><dt>Fecha de cálculo (Chile)</dt><dd><time dateTime={ranking.fecha_calculo}>{dateFormatter.format(new Date(ranking.fecha_calculo))}</time></dd></div>
      </dl>
    </section>
  );
}
