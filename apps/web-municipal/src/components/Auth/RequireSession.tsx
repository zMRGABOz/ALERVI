"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { canUseDemoSession } from "../../config/demo-session";
import { useSession } from "../../hooks/useSession";
import type { SessionRole } from "../../types/session";
import { QueryState } from "../UI/QueryState";

const MUNICIPAL_ROLES: readonly SessionRole[] = ["inspector", "administrador"];

export function RequireSession({
  children,
  roles = MUNICIPAL_ROLES,
}: {
  children: ReactNode;
  roles?: readonly SessionRole[];
}) {
  const { status, session, demoAllowed } = useSession();
  const previousStatus = useRef(status);

  useEffect(() => {
    if (previousStatus.current === "available" && status === "anonymous") {
      document.getElementById("contenido-principal")?.focus();
    }
    previousStatus.current = status;
  }, [status]);

  if (status === "initializing") {
    return <QueryState state="loading" title="Inicializando sesión" description="Comprobando el contexto de acceso municipal." />;
  }

  if (!session || (session.source === "demo" && !canUseDemoSession())) {
    return (
      <QueryState
        state="empty"
        icon="user"
        title={demoAllowed ? "Sesión local cerrada" : "Acceso municipal no disponible"}
        description={demoAllowed
          ? "Recarga esta página para restablecer la sesión de demostración local."
          : "El acceso con credenciales todavía no está disponible en esta versión. La revisión municipal está habilitada en desarrollo local con modo mock."}
      />
    );
  }

  if (!roles.includes(session.rol)) {
    return <QueryState state="error" title="Acceso restringido" description="Tu perfil no tiene permiso para acceder a esta vista." />;
  }

  // Un perfil u origen diferente desmonta los datos privados de la sesión anterior.
  return <Fragment key={`${session.source}:${session.revision}`}>{children}</Fragment>;
}
