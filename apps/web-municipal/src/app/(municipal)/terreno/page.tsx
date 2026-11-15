import type { Metadata } from "next";
import { InspectionWorkspace } from "../../../components/Inspections/InspectionWorkspace";
import { parseInspectionNavigationContext } from "../../../config/routes";

export const metadata: Metadata = { title: "Ficha de terreno · ALERVI" };

export default async function TerrenoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = parseInspectionNavigationContext(await searchParams);
  return <InspectionWorkspace context={context} />;
}
