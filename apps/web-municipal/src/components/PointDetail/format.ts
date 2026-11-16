const formatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

export function formatDetailValue(value: number | null): string {
  return value === null ? "No informado" : formatter.format(value);
}
