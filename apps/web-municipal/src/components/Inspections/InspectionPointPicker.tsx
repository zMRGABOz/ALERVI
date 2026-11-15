"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { InspectionChoice } from "../../integrations/inspection-module";
import { Icon } from "../UI/Icon";

const VISIBLE_RESULTS = 8;

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

type InspectionPointPickerProps = {
  choices: readonly InspectionChoice[];
  selectedId: number | null;
  disabled: boolean;
  loading: boolean;
  onSelect: (point: InspectionChoice) => void;
};

export function InspectionPointPicker({ choices, selectedId, disabled, loading, onSelect }: InspectionPointPickerProps) {
  const id = useId();
  const listId = `${id}-points`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [requestedIndex, setRequestedIndex] = useState(-1);
  const index = useMemo(() => choices.map((point) => ({ point, text: searchable(`punto ${point.id} ${point.name}`) })), [choices]);
  const normalizedQuery = searchable(query);
  const matches = useMemo(() => {
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    const filtered = index.filter((item) => tokens.every((token) => item.text.includes(token))).map((item) => item.point);
    const exactId = /^\d+$/.test(normalizedQuery) ? filtered.find((point) => String(point.id) === normalizedQuery) : undefined;
    return exactId ? [exactId, ...filtered.filter((point) => point.id !== exactId.id)] : filtered;
  }, [index, normalizedQuery]);
  const results = matches.slice(0, VISIBLE_RESULTS);
  const expanded = open && !disabled;
  const activeIndex = Math.min(requestedIndex, results.length - 1);
  const activeId = expanded && activeIndex >= 0 ? results[activeIndex].id : null;

  useEffect(() => {
    if (activeId === null || !listRef.current) return;
    const list = listRef.current;
    const option = document.getElementById(`${listId}-${activeId}`);
    if (!option) return;
    const bounds = list.getBoundingClientRect();
    const item = option.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  }, [activeId, listId]);

  function select(point: InspectionChoice) {
    setQuery("");
    setRequestedIndex(-1);
    inputRef.current?.focus({ preventScroll: true });
    setOpen(false);
    if (point.id !== selectedId) onSelect(point);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setRequestedIndex(event.key === "ArrowDown"
        ? !expanded || activeIndex < 0 ? 0 : Math.min(activeIndex + 1, results.length - 1)
        : !expanded || activeIndex < 0 ? results.length - 1 : Math.max(activeIndex - 1, 0));
    } else if (expanded && activeIndex >= 0 && (event.key === "Home" || event.key === "End") && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setRequestedIndex(event.key === "Home" ? 0 : results.length - 1);
    } else if (event.key === "Enter" && expanded && activeIndex >= 0) {
      event.preventDefault();
      select(results[activeIndex]);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setRequestedIndex(-1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="inspection-point-search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label htmlFor="selectorPunto">Buscar por intersección o ID</label>
      <div className="inspection-point-search__control">
        <Icon name="search" size={19} className="inspection-point-search__icon" />
        <input
          ref={inputRef}
          id="selectorPunto"
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={activeId === null ? undefined : `${listId}-${activeId}`}
          aria-describedby={hintId}
          aria-busy={loading}
          disabled={disabled}
          placeholder={loading ? "Consultando puntos…" : "Ej.: Paicaví, Los Carrera o #103"}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setRequestedIndex(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && <button type="button" className="inspection-point-search__clear" aria-label="Limpiar búsqueda" disabled={disabled} onClick={() => {
          setQuery("");
          setRequestedIndex(-1);
          inputRef.current?.focus({ preventScroll: true });
          setOpen(true);
        }}><Icon name="close" size={17} /></button>}

        {expanded && <div className="inspection-point-search__popup">
          <p className="inspection-point-search__results" role="status" aria-atomic="true">
            {matches.length === 0 ? "Sin coincidencias" : `Mostrando ${results.length} de ${matches.length} ${normalizedQuery ? "coincidencias" : "puntos disponibles"}`}
            {matches.length > VISIBLE_RESULTS && <span>Escribe más para acotar la búsqueda.</span>}
          </p>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Puntos disponibles" className="inspection-point-search__list">
            {results.map((point, position) => <li
              key={point.id}
              id={`${listId}-${point.id}`}
              role="option"
              tabIndex={-1}
              aria-selected={point.id === selectedId}
              data-active={position === activeIndex}
              className="inspection-point-search__option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(point)}
            >
              <span className="inspection-point-search__name">{point.name}</span>
              <span className="inspection-point-search__identity">Punto #{point.id}{point.id === selectedId && <span>En uso</span>}</span>
            </li>)}
          </ul>
          {!matches.length && <p className="inspection-point-search__empty">Prueba con otra calle, parte del nombre o el identificador del punto.</p>}
        </div>}
      </div>
      <p id={hintId} className="inspection-point-search__hint">Puedes buscar sin tildes y combinar nombres de calles.<span className="sr-only"> Usa las flechas para recorrer los resultados, Enter para elegir y Escape para cerrar.</span></p>
    </div>
  );
}
