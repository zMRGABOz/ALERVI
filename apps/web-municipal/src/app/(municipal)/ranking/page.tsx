import type { Metadata } from "next";
import { Suspense } from "react";
import { RankingView } from "../../../components/Ranking/RankingView";
import { QueryState } from "../../../components/UI/QueryState";

export const metadata: Metadata = {
  title: "Ranking de prioridades · ALERVI",
  description: "Prioridades viales municipales de Concepción e identificación de puntos sin índice disponible.",
};

export default function RankingPage() {
  return (
    <Suspense fallback={<QueryState state="loading" title="Preparando filtros del ranking" description="Leyendo el contexto de la consulta desde la URL." />}>
      <RankingView />
    </Suspense>
  );
}
