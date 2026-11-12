"use client";

import { useId, useState, type FormEvent } from "react";
import { rankingDataCoverage, rankingYearOptions } from "../../config/data-coverage";
import { initialRankingQuery } from "../../config/ranking";
import { defaultRankingFilterFields, rankingTopOptions, validateRankingFilterFields, type RankingFilterField, type RankingFilterFields, type RankingFiltersValue } from "../../config/ranking-filters";

type RankingFiltersProps = {
  initialFields: RankingFilterFields;
  urlErrors: readonly string[];
  onApply: (filters: RankingFiltersValue) => void;
  onReset: () => void;
};

export function RankingFilters({ initialFields, urlErrors, onApply, onReset }: RankingFiltersProps) {
  const id = useId();
  const [fields, setFields] = useState(initialFields);
  const [submitted, setSubmitted] = useState(false);
  const validation = validateRankingFilterFields(fields);
  const errors = submitted || urlErrors.length ? validation.errors : {};
  const messages = [...new Set([...urlErrors, ...Object.values(errors)])];

  function update(field: RankingFilterField, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  function reset() {
    setFields(defaultRankingFilterFields());
    setSubmitted(false);
    onReset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (validation.value) onApply(validation.value);
    else {
      const field = Object.keys(validation.errors)[0];
      const control = field ? event.currentTarget.elements.namedItem(field) : null;
      if (control instanceof HTMLElement) control.focus();
    }
  }

  function yearField(field: "year" | "startYear" | "endYear", label: string) {
    const validOption = rankingYearOptions.some((year) => String(year) === fields[field]);
    return (
      <div className="ranking-filter-field">
        <label htmlFor={`${id}-${field}`}>{label}</label>
        <div className="ranking-filter-control">
          <select
            id={`${id}-${field}`}
            name={field}
            value={fields[field]}
            onChange={(event) => update(field, event.target.value)}
            aria-invalid={!!errors[field]}
            aria-describedby={`${id}-coverage${errors[field] ? ` ${id}-${field}-error` : ""}`}
          >
            {!validOption && <option value={fields[field]}>Selecciona un año válido</option>}
            {rankingYearOptions.map((year) => <option key={year} value={year}>{year}{rankingDataCoverage.status === "propuesta" ? " · propuesto" : ""}</option>)}
          </select>
        </div>
        {errors[field] && <p className="ranking-filter-error" id={`${id}-${field}-error`}>{errors[field]}</p>}
      </div>
    );
  }

  return (
    <section className="surface-card ranking-filters" aria-labelledby={`${id}-title`}>
      <div className="ranking-filters-heading">
        <h2 id={`${id}-title`}>Filtros del ranking</h2>
        <p>Comuna fija: <strong>{initialRankingQuery.comuna}</strong></p>
      </div>
      <p className="ranking-coverage" id={`${id}-coverage`}>{rankingDataCoverage.description}</p>
      <form noValidate onSubmit={submit}>
        {messages.length > 0 && (
          <div className="ranking-filter-errors" role="alert">
            <p><strong>Revisa los filtros antes de consultar.</strong></p>
            <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
            {urlErrors.length > 0 && <p>Corrige los campos y aplica los filtros, o restablécelos para reparar la URL.</p>}
          </div>
        )}
        <div className="ranking-filter-grid">
          <div className="ranking-filter-field">
            <label htmlFor={`${id}-mode`}>Tipo de período</label>
            <div className="ranking-filter-control">
              <select id={`${id}-mode`} name="mode" value={fields.mode} onChange={(event) => update("mode", event.target.value)}>
                <option value="rango">Intervalo de años</option>
                <option value="anio">Año individual</option>
              </select>
            </div>
          </div>
          {fields.mode === "anio" ? yearField("year", "Año") : (
            <>{yearField("startYear", "Año inicial")}{yearField("endYear", "Año final")}</>
          )}
          <div className="ranking-filter-field">
            <label htmlFor={`${id}-limit`}>Cantidad de prioridades</label>
            <div className="ranking-filter-control">
              <select id={`${id}-limit`} name="limit" value={fields.limit} onChange={(event) => update("limit", event.target.value)} aria-invalid={!!errors.limit} aria-describedby={errors.limit ? `${id}-limit-error` : undefined}>
                {!rankingTopOptions.some((value) => String(value) === fields.limit) && <option value={fields.limit}>Selecciona una cantidad válida</option>}
                {rankingTopOptions.map((limit) => <option key={limit} value={limit}>Top {limit}</option>)}
              </select>
            </div>
            {errors.limit && <p className="ranking-filter-error" id={`${id}-limit-error`}>{errors.limit}</p>}
          </div>
        </div>
        <div className="ranking-filter-actions">
          <button type="submit" className="button-primary">Aplicar filtros</button>
          <button type="button" className="button-secondary" onClick={reset}>Restablecer filtros</button>
          <p>La respuesta informa el período y la versión realmente utilizados por el servicio.</p>
        </div>
      </form>
    </section>
  );
}
