import type { RankingQuery } from "../services/ranking";

export const initialRankingQuery = Object.freeze({
  comuna: "Concepción",
  limit: 10,
  offset: 0,
} satisfies RankingQuery);
