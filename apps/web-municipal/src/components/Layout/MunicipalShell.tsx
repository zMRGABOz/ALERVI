"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { MunicipalHeader } from "./MunicipalHeader";
import { MunicipalSidebar } from "./MunicipalSidebar";

export function MunicipalShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="municipal-shell">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
      <MunicipalHeader
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <div className="municipal-workspace">
        <MunicipalSidebar open={menuOpen} onClose={closeMenu} menuButtonRef={menuButtonRef} />
        <main id="contenido-principal" tabIndex={-1} className="municipal-main">
          <div className="municipal-page">{children}</div>
          <footer className="municipal-footer">
            <p>El índice expresa prioridad relativa; no representa probabilidad individual de un siniestro ni garantiza la seguridad de una vía.</p>
            <p className="shrink-0">ALERVI · Concepción, Chile</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
