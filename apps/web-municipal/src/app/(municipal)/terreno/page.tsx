"use client";

import { useState } from "react";
import { FormFicha } from "../../../components/FichaTerreno/FormFicha";
import { HistorialFichas } from "../../../components/FichaTerreno/HistorialFichas";
import type { FactorRiesgo } from "../../../components/FichaTerreno/types";
import { useSession } from "../../../hooks/useSession";

const FACTORES_INSPECCION: FactorRiesgo[] = [
  {
    id_factor: 1,
    nombre: "Falta de demarcación de cruce peatonal",
    descripcion: "Pintura termoplástica borrada o desgaste crítico en paso de cebra.",
    activo: true,
  },
  {
    id_factor: 2,
    nombre: "Visibilidad reducida por obstrucciones",
    descripcion: "Kioscos, vegetación o paraderos generan punto ciego en aproximación.",
    activo: true,
  },
  {
    id_factor: 3,
    nombre: "Falta de fase exclusiva semafórica",
    descripcion: "Viraje vehicular en conflicto directo con flujo peatonal preferente.",
    activo: true,
  },
  {
    id_factor: 4,
    nombre: "Paradero colapsado en calzada",
    descripcion: "Buses viran o se detienen en segunda fila bloqueando la visual.",
    activo: true,
  },
];

const PUNTOS_DEMO: Record<number, string> = {
  1: "Av. Paicaví con Av. Los Carrera",
  2: "Av. Arturo Prat con San Martín",
  3: "Rengo con Ejército",
  4: "Lincoyán con Ejército",
};

export default function TerrenoPage() {
  const { session, rol } = useSession();
  const [tab, setTab] = useState<"formulario" | "historial">("formulario");
  const [idPunto, setIdPunto] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const esInspector = rol === "inspector";
  const idUsuarioActual = session?.usuario?.id_usuario;
  const nombrePuntoActual = PUNTOS_DEMO[idPunto] ?? "Concepción";

  const handleCreatedSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setTab("historial");
  };

  return (
    <div className="space-y-6">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Trabajo en terreno · Dirección de Tránsito</p>
          <h1>Ficha Técnica de Terreno</h1>
          <p className="summary-heading__description">
            Evaluación de visibilidad del conductor, geometría vial y seguimiento histórico de inspecciones.
          </p>
        </div>

        <div className="flex gap-2">
          {esInspector && (
            <button
              type="button"
              className={tab === "formulario" ? "button-primary" : "button-secondary"}
              onClick={() => setTab("formulario")}
            >
              Nueva inspección
            </button>
          )}
          <button
            type="button"
            className={tab === "historial" || !esInspector ? "button-primary" : "button-secondary"}
            onClick={() => setTab("historial")}
          >
            Historial de fichas
          </button>
        </div>
      </div>

      {/* Selector rápido de punto crítico para evaluación */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <label htmlFor="selectorPunto" className="block text-xs font-semibold text-gray-700">
            Punto crítico en evaluación:
          </label>
          <p className="text-xs text-gray-500">
            Concepción · Intersección priorizada
          </p>
        </div>
        <select
          id="selectorPunto"
          value={idPunto}
          onChange={(e) => setIdPunto(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-800"
        >
          <option value={1}>Punto #1: Av. Paicaví con Av. Los Carrera</option>
          <option value={2}>Punto #2: Av. Arturo Prat con San Martín</option>
          <option value={3}>Punto #3: Rengo con Ejército</option>
          <option value={4}>Punto #4: Lincoyán con Ejército</option>
        </select>
      </div>

      {tab === "formulario" && esInspector ? (
        <FormFicha
          idPunto={idPunto}
          nombrePunto={nombrePuntoActual}
          factoresDisponibles={FACTORES_INSPECCION}
          session={session}
          authToken={session?.accessToken ?? undefined}
          rolUsuario={rol ?? undefined}
          onSubmitSuccess={handleCreatedSuccess}
        />
      ) : (
        <HistorialFichas
          idPunto={idPunto}
          session={session}
          authToken={session?.accessToken ?? undefined}
          rolUsuario={rol ?? undefined}
          idUsuarioActual={idUsuarioActual}
          factoresDisponibles={FACTORES_INSPECCION}
          refreshKey={refreshKey}
        />
      )}
    </div>
  );
}
