import type { components } from "../types/api.generated";

export type RiskLevel = components["schemas"]["PuntoCriticoProperties"]["nivel_riesgo"];

export const riskLevels = {
  CRITICO: { label: "Crítico", color: "var(--color-risk-critical)", background: "var(--color-risk-critical-bg)" },
  ALTO: { label: "Alto", color: "var(--color-risk-high)", background: "var(--color-risk-high-bg)" },
  MEDIO: { label: "Medio", color: "var(--color-risk-medium)", background: "var(--color-risk-medium-bg)" },
  BAJO: { label: "Bajo", color: "var(--color-risk-low)", background: "var(--color-risk-low-bg)" },
} as const satisfies Record<RiskLevel, { label: string; color: string; background: string }>;

export const unscoredRisk = {
  label: "Sin índice",
  color: "var(--color-unscored)",
  background: "var(--color-unscored-bg)",
} as const;

export function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "CRITICO" || value === "ALTO" || value === "MEDIO" || value === "BAJO";
}
