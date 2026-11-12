import type { Metadata } from "next";
import { MunicipalDashboard } from "../../../components/Dashboard/MunicipalDashboard";

export const metadata: Metadata = { title: "Resumen municipal · ALERVI" };

export default function SummaryPage() {
  return <MunicipalDashboard />;
}
