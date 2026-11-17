import type { Metadata } from "next";
import { PointDetail } from "../../../../components/PointDetail/PointDetail";
import { parsePointId, parsePointNavigationContext } from "../../../../config/routes";

export const metadata: Metadata = {
  title: "Detalle técnico del punto · ALERVI",
  description: "Explicación del índice de prioridad, antecedentes anuales y entorno urbano del punto consultado.",
};

type PointPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PointPage({ params, searchParams }: PointPageProps) {
  const { id } = await params;
  const context = parsePointNavigationContext(await searchParams);
  return <PointDetail key={id} id={parsePointId(id)} context={context} />;
}
