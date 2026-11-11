import type { components, operations } from "../types/api.generated";
import { apiRequest, type AuthenticatedRequestOptions } from "./api";
import { assertRankingResponse } from "./ranking-response";

export type RankingQuery = NonNullable<
  operations["getRanking"]["parameters"]["query"]
>;
export type RankingResponse = components["schemas"]["RankingResponse"];
export type RankedPoint = components["schemas"]["PuntoRankingItem"];
export type UnscoredPoint = components["schemas"]["PuntoSinIndiceItem"];

export function getRanking(
  query: RankingQuery,
  options: AuthenticatedRequestOptions,
): Promise<RankingResponse> {
  return apiRequest<unknown>("/api/v1/ranking", {
    query,
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  }).then((data) => {
    assertRankingResponse(data, query);
    return data;
  });
}
