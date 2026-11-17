export type PointDisplayCriterion = "criticidad" | "fichas";
export type PointDisplayOrder = "asc" | "desc";
export type PointDisplayFilter = {
  quantity: number;
  criterion: PointDisplayCriterion;
  order: PointDisplayOrder;
};
export type PointDisplayFields = Record<"quantity" | "criterion" | "order", string>;
export type PointDisplayErrors = Partial<Record<keyof PointDisplayFields, string>>;

export function defaultPointDisplayFields(): PointDisplayFields {
  return { quantity: "", criterion: "criticidad", order: "desc" };
}

export function validatePointDisplayFields(fields: PointDisplayFields, allowInspections: boolean, totalPoints: number | null) {
  const errors: PointDisplayErrors = {};
  const rawQuantity = fields.quantity.trim();
  const quantity = Number(rawQuantity);
  if (totalPoints === null) errors.quantity = "Espera a que se consulte el total de puntos disponibles.";
  else if (totalPoints === 0) errors.quantity = "No hay puntos disponibles para seleccionar.";
  else if (!rawQuantity || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > totalPoints) {
    errors.quantity = `Ingresa una cantidad entera entre 1 y ${numberFormatter.format(totalPoints)}.`;
  }
  const criterion = fields.criterion === "criticidad" || (allowInspections && fields.criterion === "fichas") ? fields.criterion : null;
  const order = fields.order === "asc" || fields.order === "desc" ? fields.order : null;
  if (!criterion) errors.criterion = "Selecciona un criterio disponible.";
  if (!order) errors.order = "Selecciona orden ascendente o descendente.";
  const value: PointDisplayFilter | null = criterion && order && !Object.keys(errors).length ? { quantity, criterion, order } : null;
  return { value, errors };
}

type FilterablePoint = { id_punto: number; indice_prioridad: number };

export function filterDisplayedPoints<T extends FilterablePoint>(
  points: readonly T[],
  filter: PointDisplayFilter | null,
  inspectionCounts: ReadonlyMap<number, number> | null = null,
): readonly T[] {
  if (!filter) return points;
  if (filter.criterion === "fichas" && inspectionCounts === null) return [];
  const value = (point: T) => filter.criterion === "criticidad" ? point.indice_prioridad : inspectionCounts?.get(point.id_punto) ?? 0;
  return [...points]
    .sort((left, right) => (filter.order === "asc" ? value(left) - value(right) : value(right) - value(left)) || left.id_punto - right.id_punto)
    .slice(0, filter.quantity);
}

const numberFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function describePointDisplayFilter(filter: PointDisplayFilter | null): string {
  if (!filter) return "Sin filtro aplicado.";
  const criterion = filter.criterion === "criticidad" ? "Criticidad (IP)" : "Cantidad de fichas";
  return `${numberFormatter.format(filter.quantity)} ${filter.quantity === 1 ? "punto" : "puntos"} · ${criterion} · ${filter.order === "asc" ? "Ascendente (menor a mayor)" : "Descendente (mayor a menor)"}.`;
}
