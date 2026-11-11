"use client";

import { Icon, type IconName } from "./Icon";

type QueryStateProps = {
  title: string;
  description: string;
  icon?: IconName;
} & (
  | { state: "loading" | "empty"; onRetry?: never }
  | { state: "error"; onRetry?: () => void }
);

export function QueryState({ state, title, description, icon, onRetry }: QueryStateProps) {
  return (
    <div
      className={`query-state${state === "error" ? " query-state--error" : ""}`}
      role={state === "error" ? "alert" : state === "loading" ? "status" : undefined}
    >
      <span className="query-state__icon">
        {state === "loading" ? (
          <span className="query-state__spinner" aria-hidden="true" />
        ) : (
          <Icon name={icon ?? (state === "error" ? "error" : "layers")} size={26} />
        )}
      </span>
      <h3 className="query-state__title">{title}</h3>
      <p className="query-state__description">{description}</p>
      {state === "error" && onRetry && (
        <button type="button" onClick={onRetry} className="button-primary">Reintentar</button>
      )}
    </div>
  );
}
