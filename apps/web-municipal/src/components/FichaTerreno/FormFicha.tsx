"use client";

import React, { useState } from "react";
import { createFicha, uploadFotoFicha } from "../../services/inspections";
import type { Session } from "../../types/session";
import { FactorRiesgo, NuevaFichaPayload, RolUsuario } from "./types";
import { UploadFotos } from "./UploadFotos";

export interface FormFichaProps {
  idPunto: number;
  nombrePunto?: string;
  factoresDisponibles: FactorRiesgo[];
  session?: Session | null;
  authToken?: string;
  rolUsuario?: RolUsuario;
  onSubmitSuccess?: (idFicha: number) => void;
  apiBaseUrl?: string;
}

const GUIAS_TERRENO = [
  {
    etiqueta: "Visibilidad del conductor",
    plantilla: "Visibilidad conductor: se observa punto ciego / obstrucción visual en aproximación por ",
  },
  {
    etiqueta: "Geometría y demarcación",
    plantilla: "Geometría y demarcación: estado de calzada, ancho de pistas y paso peatonal presenta ",
  },
  {
    etiqueta: "Hora punta y entorno",
    plantilla: "Flujo hora punta y entorno: conteo de virajes, paradero próximo y flujo peatonal ",
  },
  {
    etiqueta: "Medida de mitigación",
    plantilla: "Mitigación sugerida: evaluar vallas peatonales / retranqueo de paradero / fase exclusiva semafórica.",
  },
];

/**
 * Obtiene la fecha actual en formato local YYYY-MM-DD (evita desfase UTC en Chile).
 */
export function obtenerFechaHoyLocal(): string {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60 * 1000;
  return new Date(ahora.getTime() - offsetMs).toISOString().split("T")[0];
}

export const FormFicha: React.FC<FormFichaProps> = ({
  idPunto,
  nombrePunto,
  factoresDisponibles,
  session,
  authToken,
  rolUsuario = "inspector",
  onSubmitSuccess,
  apiBaseUrl = "/api/v1",
}) => {
  const fechaHoy = obtenerFechaHoyLocal();

  const [fechaVisita, setFechaVisita] = useState<string>(fechaHoy);
  const [notas, setNotas] = useState<string>("");
  const [factoresSeleccionados, setFactoresSeleccionados] = useState<number[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const esInspector = rolUsuario === "inspector";
  const factoresActivos = factoresDisponibles.filter((f) => f.activo !== false);

  const toggleFactor = (idFactor: number) => {
    setFactoresSeleccionados((prev) =>
      prev.includes(idFactor) ? prev.filter((id) => id !== idFactor) : [...prev, idFactor]
    );
  };

  const insertarPlantillaTerreno = (textoPlantilla: string) => {
    setNotas((prev) => {
      const separador = prev.trim().length > 0 ? "\n" : "";
      const nuevoTexto = `${prev}${separador}${textoPlantilla}`;
      return nuevoTexto.slice(0, 500);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!esInspector) {
      setMensaje({
        tipo: "error",
        texto: "Solo los usuarios con rol Inspector están autorizados para registrar fichas de inspección.",
      });
      return;
    }

    if (fechaVisita > fechaHoy) {
      setMensaje({ tipo: "error", texto: "La fecha de visita no puede ser futura." });
      return;
    }

    if (factoresSeleccionados.length === 0 && notas.trim().length === 0) {
      setMensaje({
        tipo: "error",
        texto:
          "La ficha requiere al menos un factor de riesgo identificado o una nota descriptiva.",
      });
      return;
    }

    if (notas.length > 500) {
      setMensaje({ tipo: "error", texto: "Las notas no pueden superar los 500 caracteres." });
      return;
    }

    setEnviando(true);

    const payload: NuevaFichaPayload = {
      id_punto: idPunto,
      fecha_visita: fechaVisita,
      notas: notas.trim() || undefined,
      factores_riesgo_ids: factoresSeleccionados,
    };

    try {
      let idFichaCreada = 1;

      if (session) {
        const data = await createFicha(payload, { session });
        idFichaCreada = data.id_ficha || 1;

        if (fotos.length > 0) {
          for (const foto of fotos) {
            await uploadFotoFicha(idFichaCreada, foto, { session });
          }
        }
      } else {
        const headersJson: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const headersAuth: Record<string, string> = {};

        if (authToken) {
          headersJson["Authorization"] = `Bearer ${authToken}`;
          headersAuth["Authorization"] = `Bearer ${authToken}`;
        }

        const res = await fetch(`${apiBaseUrl}/inspections`, {
          method: "POST",
          headers: headersJson,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Error del servidor al crear la ficha (código ${res.status})`);
        }

        const data = await res.json();
        idFichaCreada = data.id_ficha || 1;

        if (fotos.length > 0) {
          for (const foto of fotos) {
            const formData = new FormData();
            formData.append("foto", foto);
            const resFoto = await fetch(`${apiBaseUrl}/inspections/${idFichaCreada}/fotos`, {
              method: "POST",
              headers: headersAuth,
              body: formData,
            });
            if (!resFoto.ok) {
              throw new Error(
                `Ficha #${idFichaCreada} creada, pero falló la subida de "${foto.name}" (código ${resFoto.status})`
              );
            }
          }
        }
      }

      setMensaje({ tipo: "exito", texto: `Ficha #${idFichaCreada} registrada exitosamente.` });
      setNotas("");
      setFactoresSeleccionados([]);
      setFotos([]);
      if (onSubmitSuccess) onSubmitSuccess(idFichaCreada);
    } catch (err: unknown) {
      const textoError =
        err instanceof Error ? err.message : "No fue posible registrar la ficha de inspección.";
      setMensaje({
        tipo: "error",
        texto: textoError,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-white rounded-xl shadow-md border border-gray-100 space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-gray-800">Ficha Técnica de Inspección</h2>
        <p className="text-sm text-gray-500">
          Punto Crítico #{idPunto} {nombrePunto ? `— ${nombrePunto}` : ""}
        </p>
      </div>

      {!esInspector && (
        <div
          role="status"
          className="p-3 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200"
        >
          El registro de nuevas fichas en terreno está reservado para el rol Inspector. Como Administrador puede consultar el historial de inspecciones.
        </div>
      )}

      {mensaje && (
        <div
          role="alert"
          className={`p-4 rounded-lg text-sm border ${
            mensaje.tipo === "exito"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Fecha de Visita */}
      <div>
        <label htmlFor="fecha_visita" className="block text-sm font-semibold text-gray-700 mb-1">
          Fecha de Visita en Terreno *
        </label>
        <input
          id="fecha_visita"
          type="date"
          max={fechaHoy}
          value={fechaVisita}
          onChange={(e) => setFechaVisita(e.target.value)}
          required
          disabled={!esInspector}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-400 mt-1">No se admiten fechas futuras.</p>
      </div>

      {/* Factores de Riesgo activos */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Factores de Riesgo Observados
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {factoresActivos.map((factor) => {
            const isSelected = factoresSeleccionados.includes(factor.id_factor);
            return (
              <button
                key={factor.id_factor}
                type="button"
                aria-pressed={isSelected}
                disabled={!esInspector}
                onClick={() => toggleFactor(factor.id_factor)}
                className={`p-3 text-left rounded-lg border text-sm transition-all ${
                  isSelected
                    ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                } disabled:opacity-60`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    readOnly
                    checked={isSelected}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                  />
                  <span className="font-semibold">{factor.nombre}</span>
                </div>
                {factor.descripcion && (
                  <p className="text-xs text-gray-500 mt-1 pl-6">{factor.descripcion}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Observaciones Técnicas con criterios de Dirección de Tránsito */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="notas" className="block text-sm font-semibold text-gray-700">
            Observaciones Técnicas y Diagnóstico de Campo
          </label>
          <span
            className={`text-xs ${
              notas.length > 500 ? "text-red-500 font-bold" : "text-gray-400"
            }`}
          >
            {notas.length}/500 caracteres
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {GUIAS_TERRENO.map((guia) => (
            <button
              key={guia.etiqueta}
              type="button"
              disabled={!esInspector}
              onClick={() => insertarPlantillaTerreno(guia.plantilla)}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors disabled:opacity-50"
            >
              + {guia.etiqueta}
            </button>
          ))}
        </div>

        <textarea
          id="notas"
          rows={4}
          maxLength={500}
          disabled={!esInspector}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Documente la visibilidad desde la posición del conductor, obstrucciones (kioscos, vegetación, paraderos), geometría de la vía, conteos en hora punta o medidas de mitigación evaluadas..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Evidencia Fotográfica controlada */}
      <UploadFotos fotos={fotos} onFotosChange={setFotos} maxFotos={3} maxSizeMB={5} />

      {/* Botón de Envío */}
      <button
        type="submit"
        disabled={enviando || !esInspector}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors text-sm disabled:opacity-50"
      >
        {enviando ? "Guardando Ficha Técnica..." : "Registrar Ficha de Inspección"}
      </button>
    </form>
  );
};
