"use client";

import { useId, useState, type FormEvent } from "react";
import {
  defaultPointDisplayFields,
  describePointDisplayFilter,
  validatePointDisplayFields,
  type PointDisplayErrors,
  type PointDisplayFields,
  type PointDisplayFilter,
} from "../../config/point-display-filters";

type PointDisplayFiltersProps = {
  value: PointDisplayFilter | null;
  totalPoints: number | null;
  allowInspections?: boolean;
  description: string;
  onChange: (value: PointDisplayFilter | null) => void;
};

export function PointDisplayFilters({ value, totalPoints, allowInspections = false, description, onChange }: PointDisplayFiltersProps) {
  const id = useId();
  const [fields, setFields] = useState<PointDisplayFields>(defaultPointDisplayFields);
  const [errors, setErrors] = useState<PointDisplayErrors>({});
  const helpId = `${id}-help`;
  const unavailable = totalPoints === null || totalPoints === 0;

  function update(field: keyof PointDisplayFields, next: string) {
    setFields((previous) => ({ ...previous, [field]: next }));
    setErrors({});
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePointDisplayFields(fields, allowInspections, totalPoints);
    setErrors(validation.errors);
    if (validation.value) onChange(validation.value);
    else {
      const first = Object.keys(validation.errors)[0];
      if (first) document.getElementById(`${id}-${first}`)?.focus();
    }
  }

  return (
    <section className="surface-card point-display-filters" aria-labelledby={`${id}-title`}>
      <div className="point-display-filters__heading">
        <h2 id={`${id}-title`}>Filtrar puntos</h2>
        <p>{description}</p>
      </div>
      <form noValidate aria-label="Filtro de puntos" onSubmit={apply}>
        <div className="point-display-filters__grid">
          <div className="point-display-filters__field">
            <label htmlFor={`${id}-quantity`}>Cantidad de puntos</label>
            <input
              id={`${id}-quantity`}
              type="number"
              min={1}
              max={totalPoints ?? undefined}
              step={1}
              inputMode="numeric"
              placeholder="Ej. 20"
              required
              disabled={unavailable}
              value={fields.quantity}
              onChange={(event) => update("quantity", event.target.value)}
              aria-invalid={!!errors.quantity}
              aria-describedby={errors.quantity ? `${id}-quantity-error` : helpId}
            />
            {errors.quantity && <p id={`${id}-quantity-error`} className="point-display-filters__error" role="alert">{errors.quantity}</p>}
          </div>
          {allowInspections && <div className="point-display-filters__field">
            <label htmlFor={`${id}-criterion`}>Criterio</label>
            <div className="point-display-filters__control">
              <select id={`${id}-criterion`} value={fields.criterion} onChange={(event) => update("criterion", event.target.value)} aria-invalid={!!errors.criterion} aria-describedby={errors.criterion ? `${id}-criterion-error` : helpId}>
                <option value="criticidad">Criticidad (IP de 0 a 100)</option>
                <option value="fichas">Cantidad de fichas</option>
              </select>
            </div>
            {errors.criterion && <p id={`${id}-criterion-error`} className="point-display-filters__error" role="alert">{errors.criterion}</p>}
          </div>}
          {!allowInspections && <div className="point-display-filters__field">
            <p className="point-display-filters__label">Criterio</p>
            <p className="point-display-filters__criterion">Criticidad (IP de 0 a 100)</p>
          </div>}
          <div className="point-display-filters__field">
            <label htmlFor={`${id}-order`}>Orden</label>
            <div className="point-display-filters__control">
              <select id={`${id}-order`} value={fields.order} onChange={(event) => update("order", event.target.value)} aria-invalid={!!errors.order} aria-describedby={errors.order ? `${id}-order-error` : helpId}>
                <option value="desc">Descendente (mayor a menor)</option>
                <option value="asc">Ascendente (menor a mayor)</option>
              </select>
            </div>
            {errors.order && <p id={`${id}-order-error`} className="point-display-filters__error" role="alert">{errors.order}</p>}
          </div>
        </div>
        <p id={helpId} className="point-display-filters__help">{totalPoints === null ? "El rango válido se habilita al consultar los puntos disponibles."
          : totalPoints === 0 ? "El servicio no entregó puntos disponibles."
            : `Ingresa un número entero entre 1 y ${totalPoints.toLocaleString("es-CL")}. Se ordenan los ${totalPoints.toLocaleString("es-CL")} puntos disponibles y se muestran los primeros de acuerdo con la cantidad elegida.`}</p>
        <div className="point-display-filters__actions">
          <button type="submit" className="button-primary" disabled={unavailable}>Aplicar filtro</button>
          <button type="button" className="button-secondary" onClick={() => { setFields(defaultPointDisplayFields()); setErrors({}); onChange(null); }}>Restablecer</button>
          <p role="status" aria-atomic="true">{describePointDisplayFilter(value)}</p>
        </div>
      </form>
    </section>
  );
}
