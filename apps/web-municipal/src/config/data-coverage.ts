import { env } from "./env";

export type DataCoverage = Readonly<{
  status: "confirmada" | "propuesta";
  startYear: number;
  endYear: number;
  description: string;
}>;

// El contrato propone estos años; no confirma que existan registros en cada uno.
export const rankingDataCoverage: DataCoverage = Object.freeze({
  startYear: 2020,
  endYear: 2025,
  ...(env.apiMode === "mock" ? {
    status: "confirmada" as const,
    description: "Cobertura sintética de demostración: 2020–2025. Estos años corresponden a los fixtures locales, no a antecedentes históricos verificados.",
  } : {
    status: "propuesta" as const,
    description: "Años de referencia propuestos: 2020–2025. La cobertura del backend todavía no está confirmada; seleccionar un año no garantiza que existan datos.",
  }),
});

export const rankingYearOptions = Array.from(
  { length: rankingDataCoverage.endYear - rankingDataCoverage.startYear + 1 },
  (_, index) => rankingDataCoverage.endYear - index,
);
