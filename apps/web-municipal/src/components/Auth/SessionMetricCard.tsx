"use client";

import { useSession } from "../../hooks/useSession";
import { sessionRoleLabels } from "../../types/session";
import { Icon } from "../UI/Icon";
import { MetricCard } from "../UI/MetricCard";

export function SessionMetricCard() {
  const { session } = useSession();
  return (
    <MetricCard
      label="Acceso municipal"
      value={session ? sessionRoleLabels[session.rol] : null}
      description={session?.source === "demo"
        ? "Perfil ficticio de revisión local."
        : "Rol informado por el servicio de autenticación."}
      icon={<Icon name="user" />}
    />
  );
}
