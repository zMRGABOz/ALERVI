import type { components, operations } from "../types/api.generated";
import { apiRequest, type RequestOptions } from "./api";

export type RiskQuery = NonNullable<
  operations["getPuntosCriticosPublicos"]["parameters"]["query"]
>;
export type RiskPoints = components["schemas"]["GeoJsonFeatureCollection"];

export function getRiskPoints(
  query: RiskQuery = {},
  options: RequestOptions = {},
): Promise<RiskPoints> {
  return apiRequest<RiskPoints>("/api/v1/publico/riesgo", {
    query,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}
