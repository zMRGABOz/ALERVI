import type { components } from "../types/api.generated";
import { apiRequest, type AuthenticatedRequestOptions } from "./api";

export type Weights = components["schemas"]["PonderacionesScoringDto"];
export type WeightsUpdate = components["schemas"]["PonderacionesUpdateRequest"];

export function getWeights(
  options: AuthenticatedRequestOptions,
): Promise<Weights> {
  return apiRequest<Weights>("/api/v1/factores/ponderaciones", {
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}

export function updateWeights(
  weights: WeightsUpdate,
  options: AuthenticatedRequestOptions,
): Promise<Weights> {
  return apiRequest<Weights>("/api/v1/factores/ponderaciones", {
    method: "PUT",
    body: weights,
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}
