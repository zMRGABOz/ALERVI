"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../UI/Icon";

type RankingPointActionsProps = {
  pointName: string;
  detailHref: string;
  locationHref: string;
  historyHref: string;
};

type MenuPosition = { top: number; left: number; width: number; focusLast: boolean };
const MENU_HEIGHT = 146;

export function RankingPointActions({ pointName, detailHref, locationHref, historyHref }: RankingPointActionsProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const close = useCallback((restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  function open(focusLast = false) {
    const button = buttonRef.current;
    if (!button) return;
    const bounds = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(224, viewportWidth - 16);
    const left = Math.max(8, Math.min(bounds.right - width, viewportWidth - width - 8));
    const top = bounds.bottom + MENU_HEIGHT + 16 <= window.innerHeight
      ? bounds.bottom + 8
      : Math.max(8, bounds.top - MENU_HEIGHT - 8);
    setPosition({ top, left, width, focusLast });
  }

  useEffect(() => {
    if (!position) return;
    const anchorBounds = buttonRef.current?.getBoundingClientRect();
    const items = menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
    items?.[position.focusLast ? items.length - 1 : 0]?.focus({ preventScroll: true });

    function handleOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    }
    function handleScroll(event: Event) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (!bounds || bounds.top !== anchorBounds?.top || bounds.left !== anchorBounds?.left) close(true);
    }
    function handleResize() { close(true); }

    document.addEventListener("pointerdown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [position, close]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="point-detail-action ranking-actions-trigger"
        aria-label={`Acciones de ${pointName}`}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        aria-controls={position ? menuId : undefined}
        onClick={() => position ? close() : open()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            open(event.key === "ArrowUp");
          }
        }}
      >Acciones <span className="ranking-actions-chevron" aria-hidden="true" /></button>
      {position && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Acciones de ${pointName}`}
          className="ranking-actions-menu"
          style={{ top: position.top, left: position.left, width: position.width }}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget) && !buttonRef.current?.contains(event.relatedTarget)) close();
          }}
        >
          <Link href={detailHref} role="menuitem" tabIndex={-1} aria-label={`Ver detalle técnico de ${pointName}`} onClick={() => close()}><Icon name="info" size={18} />Ver detalle</Link>
          <Link href={locationHref} role="menuitem" tabIndex={-1} aria-label={`Ver ubicación de ${pointName} en el mapa público`} onClick={() => close()}><Icon name="map" size={18} />Ver ubicación</Link>
          <Link href={historyHref} role="menuitem" tabIndex={-1} aria-label={`Ver historial de fichas de ${pointName}`} onClick={() => close()}><Icon name="history" size={18} />Ver fichas</Link>
        </div>, document.body,
      )}
    </>
  );
}
