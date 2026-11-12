import type { Metadata } from "next";
import { PublicMapShell } from "../../components/Layout/PublicMapShell";
import { PublicRiskExplorer } from "../../components/Map/PublicRiskExplorer";
import { Icon } from "../../components/UI/Icon";

export const metadata: Metadata = {
  title: "Mapa público de Concepción · ALERVI",
  description: "Consulta pública de puntos críticos viales y antecedentes de Concepción, Chile.",
};

export default function PublicMapPage() {
  return (
    <PublicMapShell>
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Información vial de Concepción</p>
          <h1>Mapa público de puntos críticos</h1>
          <p className="summary-heading__description">Explora la ubicación, el nivel de prioridad y los antecedentes públicos de cada punto. Consulta abierta, sin necesidad de cuenta.</p>
        </div>
        <span className="status-badge"><Icon name="map" size={14} /> Acceso público</span>
      </div>
      <PublicRiskExplorer />
    </PublicMapShell>
  );
}
