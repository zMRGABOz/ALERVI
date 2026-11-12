import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string | number | null;
  description: string;
  icon?: ReactNode;
};

export function MetricCard({ label, value, description, icon }: MetricCardProps) {
  return (
    <article className="surface-card metric-card" aria-label={label}>
      <dl>
        <dt className="metric-card__label">
          {label}
          {icon && <span className="metric-card__icon">{icon}</span>}
        </dt>
        <dd className="metric-card__value">{value ?? "No disponible"}</dd>
      </dl>
      <p className="metric-card__description">{description}</p>
    </article>
  );
}
