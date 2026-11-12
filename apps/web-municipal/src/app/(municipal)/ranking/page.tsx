import type { Metadata } from "next";
import { RankingView } from "../../../components/Ranking/RankingView";

export const metadata: Metadata = {
  title: "Ranking de prioridades · ALERVI",
  description: "Prioridades viales municipales de Concepción e identificación de puntos sin índice disponible.",
};

export default function RankingPage() {
  return <RankingView />;
}
