"use client";

import React, { useEffect, useState } from "react";
import { getFichasPunto, updateFicha } from "../../services/inspections";
import type { Session } from "../../types/session";
import { obtenerFechaHoyLocal } from "./FormFicha";
import { ActualizarFichaPayload, FactorRiesgo, FichaInspeccion, RolUsuario } from "./types";

export interface HistorialFichasProps {
  idPunto: number;
  session?: Session | null;
  authToken?: string;
  rolUsuario?: RolUsuario;
  idUsuarioActual?: number;
  factoresDisponibles?: FactorRiesgo[];
  refreshKey?: number;
  apiBaseUrl?: string;
}

/**
 * Ordena las fichas cronológicamente de más reciente a más antigua:
 * usa `fecha_registro` como criterio principal, y `fecha_visita` / `id_ficha` como desempate.
 */
export function ordenarFichasCronologicamente(fichas: FichaInspeccion[]): FichaInspeccion[] {
  return [...fichas].sort((a, b) => {
    const fechaA = a.fecha_registro || a.fecha_visita;
    const fechaB = b.fecha_registro || b.fecha_visita;
    const diff = new Date(fechaB).getTime() - new Date(fechaA).getTime();
    if (diff !== 0 && !Number.isNaN(diff)) {
      return diff;
    }
    return b.id_ficha - a.id_ficha;
  });
}

/**
 * Determina si el usuario autenticado tiene permiso para editar una ficha específica.
 * Únicamente el Inspector que sea autor de la ficha puede actualizarla.
 */
export function puedeEditarFicha(
  ficha: Pick<FichaInspeccion, "id_inspector">,
  rolUsuario?: RolUsuario,
  idUsuarioActual?: number
): boolean {
  return (
    rolUsuario === "inspector" &&
    typeof idUsuarioActual === "number" &&
    ficha.id_inspector === idUsuarioActual
  );
}

export const HistorialFichas: React.FC<HistorialFichasProps> = ({
  idPunto,
  session,
  authToken,
  rolUsuario = "inspector",
  idUsuarioActual,
  factoresDisponibles = [],
  refreshKey = 0,
  apiBaseUrl = "/api/v1",
}) => {
  const [fichas, setFichas] = useState<FichaInspeccion[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fichaSeleccionadaId, setFichaSeleccionadaId] = useState<number | null>(null);

  // Estado de edición para ficha propia (RF-7)
  const [fichaEditandoId, setFichaEditandoId] = useState<number | null>(null);
  const [editFechaVisita, setEditFechaVisita] = useState<string>("");
  const [editNotas, setEditNotas] = useState<string>("");
  const [editFactoresIds, setEditFactoresIds] = useState<number[]>([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);
  const [mensajeEdicion, setMensajeEdicion] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarHistorial() {
      setCargando(true);
      setError(null);
      try {
        let data: FichaInspeccion[];
        if (session) {
          data = await getFichasPunto(idPunto, { session });
        } else {
          const headers: Record<string, string> = {};
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const res = await fetch(`${apiBaseUrl}/puntos/${idPunto}/fichas`, {
            headers,
          });
          if (!res.ok) {
            throw new Error(`Error al obtener historial (código ${res.status})`);
          }
          data = await res.json();
        }
        if (activo) {
          const ordenadas = ordenarFichasCronologicamente(data);
          setFichas(ordenadas);
          if (ordenadas.length > 0 && fichaSeleccionadaId === null) {
            setFichaSeleccionadaId(ordenadas[0].id_ficha);
          }
        }
      } catch (err: unknown) {
        if (activo) {
          const textoError =
            err instanceof Error
              ? err.message
              : "No se pudo cargar el historial de inspecciones.";
          setError(textoError);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarHistorial();

    return () => {
      activo = false;
    };
  }, [idPunto, session, authToken, refreshKey, apiBaseUrl, fichaSeleccionadaId]);

  const iniciarEdicion = (ficha: FichaInspeccion) => {
    setMensajeEdicion(null);
    setFichaEditandoId(ficha.id_ficha);
    setEditFechaVisita(ficha.fecha_visita);
    setEditNotas(ficha.notas || "");
    setEditFactoresIds((ficha.factores_riesgo || []).map((f) => f.id_factor));
  };

  const cancelarEdicion = () => {
    setFichaEditandoId(null);
    setMensajeEdicion(null);
  };

  const toggleFactorEdicion = (idFactor: number) => {
    setEditFactoresIds((prev) =>
      prev.includes(idFactor) ? prev.filter((id) => id !== idFactor) : [...prev, idFactor]
    );
  };

  const guardarEdicion = async (fichaOriginal: FichaInspeccion) => {
    setMensajeEdicion(null);
    const fechaHoy = obtenerFechaHoyLocal();

    if (editFechaVisita > fechaHoy) {
      setMensajeEdicion({
        tipo: "error",
        texto: "La fecha de visita no puede ser futura.",
      });
      return;
    }

    if (editFactoresIds.length === 0 && editNotas.trim().length === 0) {
      setMensajeEdicion({
        tipo: "error",
        texto: "La ficha debe mantener al menos un factor de riesgo o una observación técnica.",
      });
      return;
    }

    if (editNotas.length > 500) {
      setMensajeEdicion({
        tipo: "error",
        texto: "Las observaciones no pueden superar los 500 caracteres.",
      });
      return;
    }

    setGuardandoEdicion(true);
    const payload: ActualizarFichaPayload = {
      fecha_visita: editFechaVisita,
      notas: editNotas.trim() || undefined,
      factores_riesgo_ids: editFactoresIds,
    };

    try {
      let actualizada: FichaInspeccion;
      if (session) {
        actualizada = await updateFicha(fichaOriginal.id_ficha, payload, { session });
      } else {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const res = await fetch(`${apiBaseUrl}/inspections/${fichaOriginal.id_ficha}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("No tiene permisos para editar una ficha creada por otro inspector.");
          }
          throw new Error(`No fue posible actualizar la ficha (código ${res.status}).`);
        }

        actualizada = await res.json();
      }
      setFichas((prev) =>
        ordenarFichasCronologicamente(
          prev.map((item) => (item.id_ficha === actualizada.id_ficha ? actualizada : item))
        )
      );
      setFichaEditandoId(null);
      setMensajeEdicion({
        tipo: "exito",
        texto: `Ficha #${fichaOriginal.id_ficha} actualizada correctamente.`,
      });
    } catch (err: unknown) {
      const texto =
        err instanceof Error ? err.message : "Error al guardar los cambios de la ficha.";
      setMensajeEdicion({ tipo: "error", texto });
    } finally {
      setGuardandoEdicion(false);
    }
  };

  if (cargando) {
    return (
      <div className="p-4 text-sm text-gray-500 animate-pulse">
        Cargando historial de inspecciones...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200"
      >
        {error}
      </div>
    );
  }

  if (fichas.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-lg text-center border border-gray-100">
        No se registran fichas técnicas de inspección para este punto crítico.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            Historial de Fichas ({fichas.length})
          </h3>
          <p className="text-xs text-gray-500">
            Seleccione una ficha para inspeccionar su detalle completo, antecedentes de conteos y fotografías.
          </p>
        </div>
      </div>

      {mensajeEdicion && (
        <div
          role="alert"
          className={`p-3 rounded-lg text-xs border ${
            mensajeEdicion.tipo === "exito"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {mensajeEdicion.texto}
        </div>
      )}

      <div className="space-y-3">
        {fichas.map((ficha) => {
          const estaSeleccionada = fichaSeleccionadaId === ficha.id_ficha;
          const estaEditando = fichaEditandoId === ficha.id_ficha;
          const esEditablePorUsuario = puedeEditarFicha(ficha, rolUsuario, idUsuarioActual);
          const catalogoFactores =
            factoresDisponibles.length > 0 ? factoresDisponibles : ficha.factores_riesgo || [];

          return (
            <div
              key={ficha.id_ficha}
              data-testid={`ficha-item-${ficha.id_ficha}`}
              className={`rounded-lg border transition-all ${
                estaSeleccionada
                  ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500"
                  : "bg-white border-gray-200 shadow-sm hover:border-gray-300"
              }`}
            >
              {/* Cabecera clickeable para seleccionar / expandir la ficha */}
              <button
                type="button"
                aria-expanded={estaSeleccionada}
                onClick={() =>
                  setFichaSeleccionadaId(estaSeleccionada ? null : ficha.id_ficha)
                }
                className="w-full p-4 text-left flex justify-between items-start gap-4 focus:outline-none"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      Ficha #{ficha.id_ficha}
                    </span>
                    <span className="text-xs text-gray-600 font-medium">
                      Visita: {ficha.fecha_visita}
                    </span>
                    {esEditablePorUsuario && (
                      <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                        Autoría propia
                      </span>
                    )}
                  </div>
                  {!estaSeleccionada && ficha.notas && (
                    <p className="mt-1.5 text-xs text-gray-600 line-clamp-1">
                      {ficha.notas}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="block text-xs text-gray-500">
                    Inspector: {ficha.correo_inspector || `ID ${ficha.id_inspector}`}
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">
                    {estaSeleccionada ? "Ocultar detalle" : "Ver detalle"}
                  </span>
                </div>
              </button>

              {/* Panel de Detalle Desplegado al seleccionar la ficha */}
              {estaSeleccionada && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
                  {ficha.fecha_registro && (
                    <p className="text-[11px] text-gray-400">
                      Fecha de registro en sistema: {ficha.fecha_registro}
                    </p>
                  )}

                  {!estaEditando ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          Observaciones técnicas y acuerdos registrados:
                        </p>
                        {ficha.notas ? (
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-100 whitespace-pre-line">
                            {ficha.notas}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            Sin observaciones descriptivas adicionales.
                          </p>
                        )}
                      </div>

                      {ficha.factores_riesgo && ficha.factores_riesgo.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Factores de riesgo identificados:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ficha.factores_riesgo.map((factor) => (
                              <span
                                key={factor.id_factor}
                                className="text-xs px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-medium"
                              >
                                {factor.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          Evidencia fotográfica ({ficha.fotografias ? ficha.fotografias.length : 0}):
                        </p>
                        {ficha.fotografias && ficha.fotografias.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {ficha.fotografias.map((foto, index) => (
                              <a
                                key={foto.id_foto}
                                href={foto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1 bg-slate-50 text-blue-700 border border-slate-200 rounded hover:bg-slate-100 font-medium"
                              >
                                Fotografía #{index + 1} (ID {foto.id_foto})
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">
                            No se adjuntaron fotografías en esta inspección.
                          </p>
                        )}
                      </div>

                      {/* Barra de acciones dependiente del rol y autoría */}
                      <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                        {esEditablePorUsuario ? (
                          <button
                            type="button"
                            onClick={() => iniciarEdicion(ficha)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                          >
                            Editar ficha propia
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            {rolUsuario === "administrador"
                              ? "Modo consulta (el rol Administrador no modifica fichas de terreno)"
                              : idUsuarioActual !== undefined
                                ? "Solo lectura (solo el inspector autor puede editar esta ficha)"
                                : "Modo consulta de historial"}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Formulario de edición en línea para ficha propia (RF-7) */
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-slate-800">
                        Editando Ficha #{ficha.id_ficha}
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Fecha de visita
                        </label>
                        <input
                          type="date"
                          max={obtenerFechaHoyLocal()}
                          value={editFechaVisita}
                          onChange={(e) => setEditFechaVisita(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white"
                        />
                      </div>

                      {catalogoFactores.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Factores de riesgo asociados
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {catalogoFactores.map((factor) => {
                              const activo = editFactoresIds.includes(factor.id_factor);
                              return (
                                <button
                                  key={factor.id_factor}
                                  type="button"
                                  onClick={() => toggleFactorEdicion(factor.id_factor)}
                                  className={`text-xs px-2.5 py-1 rounded border ${
                                    activo
                                      ? "bg-blue-600 text-white border-blue-600 font-medium"
                                      : "bg-white text-gray-700 border-gray-300"
                                  }`}
                                >
                                  {factor.nombre}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-semibold text-gray-700">
                            Observaciones técnicas
                          </label>
                          <span className="text-[11px] text-gray-400">
                            {editNotas.length}/500 caracteres
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={editNotas}
                          onChange={(e) => setEditNotas(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={cancelarEdicion}
                          disabled={guardandoEdicion}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => guardarEdicion(ficha)}
                          disabled={guardandoEdicion}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
