"use client";

import React, { useRef, useState } from "react";

export interface UploadFotosProps {
  idFicha?: number;
  fotos?: File[];
  onFotosChange?: (fotos: File[]) => void;
  maxFotos?: number;
  maxSizeMB?: number;
}

/**
 * Valida las reglas de negocio sobre los archivos seleccionados antes de sanitizarlos:
 * - Límite de cantidad máxima (3 fotografías por ficha).
 * - Formato admitido (únicamente image/jpeg o image/png).
 * - Tamaño máximo por archivo (<= 5 MB).
 */
export function validarSeleccionFotografias(
  archivosExistentesCount: number,
  nuevosArchivos: Pick<File, "name" | "type" | "size">[],
  maxFotos = 3,
  maxSizeMB = 5
): string | null {
  if (archivosExistentesCount + nuevosArchivos.length > maxFotos) {
    return "La ficha admite un máximo de 3 fotografías";
  }

  for (const archivo of nuevosArchivos) {
    if (!["image/jpeg", "image/png"].includes(archivo.type)) {
      return `El archivo "${archivo.name}" no es válido. Solo se admiten formatos JPEG o PNG.`;
    }

    const sizeMB = archivo.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `El archivo "${archivo.name}" excede el límite de ${maxSizeMB} MB.`;
    }
  }

  return null;
}

/**
 * Sanitiza una imagen en el cliente redibujándola en un Canvas HTML5.
 * Elimina completamente los metadatos EXIF (coordenadas GPS de la cámara, dispositivo, etc.)
 * antes de enviar al almacenamiento.
 */
export async function sanitizarExif(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 1;
      canvas.height = img.naturalHeight || img.height || 1;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("El navegador no soporta contexto 2D para sanitizar EXIF."));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo generar el binario sanitizado sin EXIF."));
            return;
          }
          const sanitizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(sanitizedFile);
        },
        file.type,
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No fue posible procesar la imagen para sanitización."));
    };

    img.src = url;
  });
}

const PERSPECTIVAS_SUGERIDAS = [
  "1. Perspectiva real de aproximación desde la posición del conductor",
  "2. Obstrucciones de visibilidad (kioscos, vegetación, paraderos o puntos ciegos)",
  "3. Estado de señalización, demarcación de calzada y fases semafóricas",
];

export const UploadFotos: React.FC<UploadFotosProps> = ({
  fotos,
  onFotosChange,
  maxFotos = 3,
  maxSizeMB = 5,
}) => {
  const [archivosInternos, setArchivosInternos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Si el componente padre pasa `fotos`, opera de forma controlada; de lo contrario, usa estado interno
  const archivos = fotos !== undefined ? fotos : archivosInternos;

  const actualizarArchivos = (nuevos: File[]) => {
    if (fotos === undefined) {
      setArchivosInternos(nuevos);
    }
    if (onFotosChange) {
      onFotosChange(nuevos);
    }
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";

    if (files.length === 0) return;

    const errorValidacion = validarSeleccionFotografias(
      archivos.length,
      files,
      maxFotos,
      maxSizeMB
    );
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setProcesando(true);
    const nuevasFotos: File[] = [];

    for (const f of files) {
      try {
        const fotoSanitizada = await sanitizarExif(f);
        nuevasFotos.push(fotoSanitizada);
      } catch {
        setError(`Error al sanitizar metadatos de "${f.name}".`);
        setProcesando(false);
        return;
      }
    }

    const actualizadas = [...archivos, ...nuevasFotos];
    actualizarArchivos(actualizadas);
    setProcesando(false);
  };

  const handleEliminarFoto = (index: number) => {
    const filtradas = archivos.filter((_, i) => i !== index);
    actualizarArchivos(filtradas);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-700">
          Evidencia Fotográfica ({archivos.length}/{maxFotos})
        </label>
        <p className="text-xs text-gray-500 mt-0.5">
          No basta con una toma frontal del cruce; registre la perspectiva de visibilidad real del conductor y los posibles obstáculos visuales.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-700 mb-1">
          Ángulos recomendados por Dirección de Tránsito:
        </p>
        <ul className="text-xs text-slate-600 space-y-0.5">
          {PERSPECTIVAS_SUGERIDAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200"
        >
          {error}
        </div>
      )}

      {archivos.length < maxFotos && (
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-2 text-gray-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mb-1 text-sm text-gray-600">
                <span className="font-semibold">Haga clic para subir</span> o arrastre aquí
              </p>
              <p className="text-xs text-gray-500">
                JPEG o PNG (máx. {maxSizeMB} MB por foto, metadatos EXIF eliminados automáticamente)
              </p>
            </div>
            <input
              ref={inputRef}
              data-testid="input-upload-fotos"
              type="file"
              className="hidden"
              multiple
              accept="image/jpeg,image/png"
              onChange={handleFileSelection}
              disabled={procesando}
            />
          </label>
        </div>
      )}

      {procesando && (
        <p className="text-sm text-blue-600 animate-pulse">Sanitizando metadatos EXIF...</p>
      )}

      {archivos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {archivos.map((foto, idx) => (
            <div
              key={`${foto.name}-${idx}`}
              className="relative p-2.5 bg-white rounded border border-gray-200 shadow-sm"
            >
              <p className="text-[11px] font-semibold text-blue-700 mb-0.5">
                Toma #{idx + 1}
              </p>
              <p className="text-xs truncate font-medium text-gray-800">{foto.name}</p>
              <p className="text-[10px] text-gray-500">
                {(foto.size / 1024).toFixed(0)} KB · Sin metadatos EXIF
              </p>
              <button
                type="button"
                onClick={() => handleEliminarFoto(idx)}
                className="mt-2 w-full text-xs text-red-600 hover:text-red-800 font-semibold text-left"
              >
                Eliminar fotografía
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
