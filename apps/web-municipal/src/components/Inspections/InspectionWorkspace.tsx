"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { inspectionHref, routes, type InspectionNavigationContext, type InspectionView } from "../../config/routes";
import { useInspectionContext } from "../../hooks/useInspectionContext";
import { useSession } from "../../hooks/useSession";
import { FormFicha, HistorialFichas } from "../../integrations/inspection-module";
import type { ApiError } from "../../services/api";
import { QueryState } from "../UI/QueryState";
import { InspectionPointPicker } from "./InspectionPointPicker";

function InspectionError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return <div className="surface-card ranking-state-panel"><QueryState
    state="error"
    title={error.status === 404 ? "Punto no disponible para terreno" : error.status === 401 ? "Sesión no válida" : error.status === 403 ? "Sin permiso para consultar terreno" : "No se pudo preparar terreno"}
    description={error.message}
    onRetry={error.status === 401 || error.status === 403 ? undefined : onRetry}
  /></div>;
}

export function InspectionWorkspace({ context }: { context: InspectionNavigationContext }) {
  const router = useRouter();
  const { session, rol } = useSession();
  const selectedId = context.invalid ? null : context.id;
  const query = useInspectionContext(selectedId);
  const activePointId = useRef(selectedId);
  const point = query.point.data;
  const [savedFicha, setSavedFicha] = useState<{ pointId: number; id: number } | null>(null);
  const esInspector = rol === "inspector";
  const form = context.view === "nueva" && esInspector;
  const choices = query.catalog.data?.choices ?? [];
  const options = selectedId !== null && !choices.some((item) => item.id === selectedId)
    ? [{ id: selectedId, name: point?.name ?? "Nombre pendiente de consulta" }, ...choices]
    : choices;
  const selectedChoice = options.find((item) => item.id === selectedId);
  const origin = context.hasOrigin ? context.returnTo : undefined;
  const returnPath = context.returnTo.split("?")[0];
  const returnLabel = returnPath.startsWith("/puntos/") ? "análisis" : returnPath === routes.summary ? "resumen" : "ranking";

  useEffect(() => {
    activePointId.current = selectedId;
    return () => { activePointId.current = null; };
  }, [selectedId]);

  function show(view: InspectionView) {
    setSavedFicha(null);
    router.replace(inspectionHref(selectedId, view, origin), { scroll: false });
  }

  return (
    <div className="inspection-workspace">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Trabajo en terreno · Dirección de Tránsito</p>
          <h1>Ficha Técnica de Terreno</h1>
          <p className="summary-heading__description">Consulta las inspecciones de un punto o registra una nueva ficha. Puedes cambiar el punto de trabajo desde aquí.</p>
        </div>
      </div>

      {origin && <div className="inspection-origin">
        <span>Consulta de origen</span>
        <Link href={origin} className="inline-link">Retomar {returnLabel} <span aria-hidden="true">↗</span></Link>
      </div>}

      <section className="surface-card inspection-context" aria-label="Contexto del punto de inspección">
        <div>
          <h2>Punto de trabajo</h2>
          <p className="text-muted text-sm">Concepción{query.catalog.status === "success" && ` · ${options.length} puntos disponibles`}</p>
          <div className="inspection-current-point">
            {selectedChoice && <p className="inspection-current-point__name"><span>Punto actual</span>{point?.name ?? selectedChoice.name}</p>}
            <p id="inspection-point-status" className="inspection-point-status" role="status">
              {point ? <>Punto #{point.id} · Fichas registradas: <strong>{point.count === null ? "No informado" : point.count}</strong></>
                : selectedId !== null && query.point.status === "loading" ? `Consultando punto #${selectedId}…` : "Elige un punto para consultar o registrar sus inspecciones."}
            </p>
          </div>
        </div>
        <InspectionPointPicker
          choices={options}
          selectedId={selectedId}
          disabled={query.catalog.status !== "success"}
          loading={query.catalog.status === "loading"}
          onSelect={(selected) => {
            activePointId.current = selected.id;
            setSavedFicha(null);
            router.replace(inspectionHref(selected.id, context.view, origin), { scroll: false });
          }}
        />
      </section>

      <div className="inspection-view-switch" role="group" aria-label="Vista de fichas de terreno">
        <button type="button" aria-pressed={!form} aria-controls="inspection-content" onClick={() => show("historial")}>Historial de fichas</button>
        {esInspector && <button type="button" aria-pressed={form} aria-controls="inspection-content" onClick={() => show("nueva")}>Nueva inspección</button>}
      </div>

      <section id="inspection-content" className="inspection-content" aria-label={form ? "Registro de inspección" : "Historial del punto"}>
        {context.invalid ? <div className="surface-card ranking-state-panel"><QueryState state="empty" icon="inspection" title="Contexto de terreno no válido" description="El punto debe ser un entero positivo y la vista debe ser nueva o historial. Selecciona un punto de trabajo para continuar." /></div>
          : query.catalog.status === "loading" ? <div className="surface-card ranking-state-panel"><QueryState state="loading" title="Preparando terreno" description="Consultando los puntos y factores disponibles." /></div>
            : query.catalog.status === "error" ? <InspectionError error={query.catalog.error} onRetry={query.refetchCatalog} />
              : selectedId === null ? <div className="surface-card ranking-state-panel"><QueryState state="empty" icon="inspection" title={choices.length ? "Selecciona un punto de trabajo" : "No hay puntos disponibles en el catálogo"} description="Busca una intersección o un ID para abrir su historial o registrar una nueva ficha de terreno." /></div>
                : query.point.status === "loading" ? <div className="surface-card ranking-state-panel"><QueryState state="loading" title="Consultando punto" description="Obteniendo el contexto de las inspecciones." /></div>
                  : query.point.status === "error" ? <InspectionError error={query.point.error} onRetry={query.refetch} />
                    : !point ? null : form ? <>
                <p className="inspection-form-hint">Al cambiar de punto se inicia una ficha nueva. El registro se realiza únicamente al enviar el formulario.</p>
                {!query.catalog.data.factors.length && <p className="detail-notice" role="status">El servicio no entregó factores activos. Puedes registrar una observación técnica según las reglas del formulario.</p>}
                <FormFicha
                  key={point.id}
                  idPunto={point.id}
                  nombrePunto={point.name}
                  factoresDisponibles={query.catalog.data.factors}
                  session={session}
                  authToken={session?.accessToken ?? undefined}
                  rolUsuario={rol ?? undefined}
                  onSubmitSuccess={(id) => {
                    if (activePointId.current !== point.id) return;
                    setSavedFicha({ pointId: point.id, id });
                    query.refetch();
                    router.replace(inspectionHref(point.id, "historial", origin), { scroll: false });
                  }}
                />
                <button type="button" className="button-secondary" onClick={() => show("historial")}>Cancelar</button>
              </> : <>
                {savedFicha?.pointId === point.id && <p className="inspection-save-notice" role="status">Ficha #{savedFicha.id} registrada. Ya puedes consultarla en el historial de este punto.</p>}
                {!esInspector && context.view === "nueva" && <p className="detail-notice" role="status">El registro de nuevas fichas está reservado al Inspector. Tu perfil puede consultar el historial.</p>}
                <HistorialFichas
                  key={point.id}
                  idPunto={point.id}
                  session={session}
                  authToken={session?.accessToken ?? undefined}
                  rolUsuario={rol ?? undefined}
                  idUsuarioActual={session?.usuario.id_usuario}
                  factoresDisponibles={query.catalog.data.factors}
                />
              </>}
      </section>
    </div>
  );
}
