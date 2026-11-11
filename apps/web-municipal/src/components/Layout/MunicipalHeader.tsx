import Link from "next/link";
import type { Ref } from "react";
import { navigationDialogId } from "../../config/navigation";
import { routes } from "../../config/routes";
import { Icon } from "../UI/Icon";

type MunicipalHeaderProps = {
  menuOpen: boolean;
  menuButtonRef: Ref<HTMLButtonElement>;
  onOpenMenu: () => void;
};

export function MunicipalHeader({
  menuOpen,
  menuButtonRef,
  onOpenMenu,
}: MunicipalHeaderProps) {
  return (
    <header className="municipal-header">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button mobile-menu-button"
          aria-label="Abrir menú de navegación"
          aria-controls={navigationDialogId}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={onOpenMenu}
        >
          <Icon name="menu" />
        </button>
        <Link href={routes.summary} className="municipal-brand" aria-label="ALERVI · Ir al resumen">
          <span className="municipal-brand__symbol"><Icon name="brand" size={24} /></span>
          <span>
            <span className="municipal-brand__name">ALERVI</span>
            <span className="municipal-brand__description">Plataforma municipal · Concepción</span>
          </span>
        </Link>
      </div>
      <div className="session-status" aria-label="Estado de sesión: sin iniciar">
        <Icon name="user" size={18} />
        <span className="hidden sm:inline">Sesión sin iniciar</span>
      </div>
    </header>
  );
}
