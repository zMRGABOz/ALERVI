"use client";

import Link from "next/link";
import { routes } from "../../config/routes";
import { useSession } from "../../hooks/useSession";
import type { ApiError } from "../../services/api";
import { QueryState } from "../UI/QueryState";

export function RankingErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const { source, logout } = useSession();
  const unauthorized = error.status === 401;
  const forbidden = error.status === 403;
  const accessError = unauthorized || forbidden;
  const title = unauthorized ? "Sesión no válida" : forbidden ? "Sin permiso para consultar el ranking" : "No se pudo cargar el ranking";
  const description = unauthorized
    ? source === "demo"
      ? "La consulta rechazó el perfil local. Puedes restablecer la sesión de demostración para volver a consultar."
      : "La sesión no es válida o expiró. Cierra la sesión y vuelve a autenticarte."
    : forbidden
      ? "El servicio no autoriza esta consulta con el perfil actual. Utiliza un perfil municipal con permiso de acceso."
      : error.message;

  return (
    <>
      <QueryState state="error" title={title} description={description} onRetry={accessError ? undefined : onRetry} />
      {accessError && (
        <div className="ranking-access-actions">
          {unauthorized && (source === "demo"
            ? <button type="button" className="button-primary" onClick={() => window.location.reload()}>Restablecer sesión local</button>
            : <button type="button" className="button-primary" onClick={logout}>Cerrar sesión</button>)}
          <Link href={routes.map} className="button-secondary">Ir al mapa público</Link>
        </div>
      )}
    </>
  );
}
