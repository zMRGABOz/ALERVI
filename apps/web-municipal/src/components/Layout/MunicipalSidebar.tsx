"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { municipalNavigation, navigationDialogId } from "../../config/navigation";
import { Icon } from "../UI/Icon";

function NavigationContent({
  idPrefix,
  onNavigate,
}: {
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación municipal">
      {municipalNavigation.map((group) => (
        <div key={group.id} className="navigation-group">
          <p id={`${idPrefix}-${group.id}`} className="navigation-group__label">{group.label}</p>
          <ul aria-labelledby={`${idPrefix}-${group.id}`} className="space-y-1">
            {group.items.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="navigation-item"
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} className="shrink-0" />
                    <span className="navigation-item__label">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="navigation-item navigation-item--disabled"
                    aria-describedby={`${idPrefix}-${item.id}-reason`}
                  >
                    <Icon name={item.icon} className="shrink-0" />
                    <span>
                      <span className="navigation-item__label">{item.label}</span>
                      <span id={`${idPrefix}-${item.id}-reason`} className="navigation-item__reason">
                        {item.unavailableReason}
                      </span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarContext() {
  return (
    <div className="sidebar-context">
      <p className="flex items-center gap-2 font-semibold"><Icon name="point" size={16} /> Concepción, Chile</p>
      <p className="mt-2">Herramienta de apoyo a la priorización de intervenciones viales.</p>
    </div>
  );
}

function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;

  const dialog = event.currentTarget;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls[controls.length - 1];

  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

type MunicipalSidebarProps = {
  open: boolean;
  onClose: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
};

export function MunicipalSidebar({ open, onClose, menuButtonRef }: MunicipalSidebarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [onClose]);

  function restoreFocus() {
    onClose();
    if (menuButtonRef.current?.getClientRects().length) {
      menuButtonRef.current.focus();
    } else {
      document.getElementById("contenido-principal")?.focus();
    }
  }

  return (
    <>
      <aside className="municipal-sidebar" aria-label="Panel municipal">
        <NavigationContent idPrefix="sidebar" />
        <SidebarContext />
      </aside>
      <dialog
        ref={dialogRef}
        id={navigationDialogId}
        aria-labelledby="titulo-menu-municipal"
        className="navigation-dialog"
        onKeyDown={containDialogFocus}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClose={restoreFocus}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left || event.clientX > box.right ||
            event.clientY < box.top || event.clientY > box.bottom
          ) onClose();
        }}
      >
        <div className="navigation-dialog__header">
          <h2 id="titulo-menu-municipal" className="font-semibold">Menú municipal</h2>
          <button type="button" className="icon-button" aria-label="Cerrar menú de navegación" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="navigation-dialog__content">
          <NavigationContent idPrefix="drawer" onNavigate={onClose} />
        </div>
        <SidebarContext />
      </dialog>
    </>
  );
}
