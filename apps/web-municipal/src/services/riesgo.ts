import type { components, operations } from "../types/api.generated";
import { apiRequest, type RequestOptions } from "./api";
import { toPublicRiskPoints } from "../components/Map/public-points";
import { queryKey, readCachedQuery } from "./query-cache";

export type RiskQuery = NonNullable<
  operations["getPuntosCriticosPublicos"]["parameters"]["query"]
>;
export type RiskPoints = components["schemas"]["GeoJsonFeatureCollection"];

export function getRiskPoints(
  query: RiskQuery = {},
  options: RequestOptions = {},
): Promise<RiskPoints> {
  return readCachedQuery(queryKey("risk-points", query), { signal: options.signal }, (signal) => apiRequest<RiskPoints>("/api/v1/publico/riesgo", {
    query,
    signal,
    timeoutMs: options.timeoutMs,
  }).then((data) => {
    toPublicRiskPoints(data);
    return data;
  }));
}
