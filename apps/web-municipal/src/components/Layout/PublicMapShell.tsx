"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { municipalEntry } from "../../config/navigation";
import { routes } from "../../config/routes";
import { useSession } from "../../hooks/useSession";
import { Icon } from "../UI/Icon";
import { MunicipalShell } from "./MunicipalShell";

export function PublicMapShell({ children }: { children: ReactNode }) {
  const { session, status } = useSession();
  const previousStatus = useRef(status);

  useEffect(() => {
    if (previousStatus.current === "available" && status === "anonymous") {
      document.getElementById("contenido-principal")?.focus();
    }
    previousStatus.current = status;
  }, [status]);

  if (status === "available" && session) {
    return (
      <MunicipalShell>
        <div className="public-map-page">{children}</div>
      </MunicipalShell>
    );
  }

  return (
    <div className="public-map-shell">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
      <header className="municipal-header public-map-header">
        <Link href={routes.map} className="municipal-brand" aria-label="ALERVI · Mapa público">
          <span className="municipal-brand__symbol"><Icon name="brand" size={24} /></span>
          <span><span className="municipal-brand__name">ALERVI</span><span className="municipal-brand__description">Consulta pública · Concepción</span></span>
        </Link>
        <nav aria-label="Acceso municipal"><Link href={municipalEntry.href} className="button-secondary"><Icon name="summary" size={18} />{municipalEntry.label}</Link></nav>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="public-map-main public-map-page">
        {children}
        <footer className="municipal-footer">
          <p>El índice expresa prioridad relativa; no representa probabilidad individual de un siniestro ni garantiza la seguridad de una vía.</p>
          <p>ALERVI · Concepción, Chile</p>
        </footer>
      </main>
    </div>
  );
}
