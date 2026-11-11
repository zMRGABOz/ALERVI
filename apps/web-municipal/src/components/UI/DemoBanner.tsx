import { env } from "../../config/env";

export function DemoBanner() {
  if (env.apiMode === "api") return null;

  const isMock = env.apiMode === "mock";

  return (
    <aside
      aria-label="Modo de datos"
      className="border-b border-[var(--color-risk-medium)] bg-[var(--color-risk-medium-bg)] px-6 py-3 text-[var(--color-risk-medium)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm leading-6">
        <strong>{isMock ? "Datos de demostración" : "API de demostración"}</strong>
        <p>
          {isMock
            ? "Datos sintéticos de Concepción. Los cambios de ponderaciones solo se conservan en memoria y se reinician al recargar."
            : "Conexión HTTP a un servidor de prueba. Sus respuestas son demostrativas; no acreditan datos ni persistencia reales."}
        </p>
      </div>
    </aside>
  );
}
