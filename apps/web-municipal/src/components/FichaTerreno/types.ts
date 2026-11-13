/**
 * Tipos TypeScript compartidos para el módulo de Fichas de Inspección Técnica.
 * Basado en openapi.yaml y modelos relacionales del SRS (E1).
 */

export type RolUsuario = "inspector" | "administrador";

export interface FactorRiesgo {
  id_factor: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface FotografiaFicha {
  id_foto: number;
  id_ficha: number;
  ruta: string;
  url: string;
  tamano_bytes?: number;
  fecha_subida?: string;
}

export interface FichaInspeccion {
  id_ficha: number;
  id_punto: number;
  nombre_interseccion?: string;
  id_inspector: number;
  correo_inspector?: string;
  fecha_visita: string;
  fecha_registro?: string;
  notas?: string;
  factores_riesgo: FactorRiesgo[];
  fotografias: FotografiaFicha[];
}

export interface NuevaFichaPayload {
  id_punto: number;
  fecha_visita: string;
  notas?: string;
  factores_riesgo_ids: number[];
}

export interface ActualizarFichaPayload {
  fecha_visita?: string;
  notas?: string;
  factores_riesgo_ids?: number[];
}
