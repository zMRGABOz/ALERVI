import { riskLevels, unscoredRisk, type RiskLevel } from "../../config/risk-levels";

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  const appearance = level === null ? unscoredRisk : riskLevels[level];
  return (
    <span className="risk-badge" style={{ color: appearance.color, backgroundColor: appearance.background }}>
      {appearance.label}
    </span>
  );
}
