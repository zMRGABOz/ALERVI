import type { components, operations } from "../types/api.generated";
import { apiRequest, type AuthenticatedRequestOptions } from "./api";

export type RankingQuery = NonNullable<
  operations["getRanking"]["parameters"]["query"]
>;
export type RankingResponse = components["schemas"]["RankingResponse"];

export function getRanking(
  query: RankingQuery,
  options: AuthenticatedRequestOptions,
): Promise<RankingResponse> {
  return apiRequest<RankingResponse>("/api/v1/ranking", {
    query,
    auth: "required",
    session: options.session,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}
