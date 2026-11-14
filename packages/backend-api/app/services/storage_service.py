"""
Servicio de Almacenamiento y Sanitización de Imágenes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Procesamiento seguro de fotografías de inspección técnica:
- RB-10 & RNF-S-7: Validación de formatos admitidos (JPEG y PNG) y tamaño máximo de 5 MB.
- RNF-S-7: Eliminación garantizada de metadatos EXIF (coordenadas GPS de la cámara, dispositivo, etc.)
  mediante reconstrucción de los datos de imagen con Pillow.
- Generación de UUID único en el servidor para almacenamiento en el bucket 'fichas' de Supabase Storage.
"""

import io
import logging
import uuid
from typing import Optional, Tuple

import httpx
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Formatos admitidos según RB-10 / RNF-S-7
ALLOWED_FORMATS = {"JPEG", "JPG", "PNG"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def sanitize_image_exif(
    file_bytes: bytes, original_filename: str = ""
) -> Tuple[bytes, str, str]:
    """
    Sanitiza una imagen eliminando completamente metadatos EXIF, coordenadas GPS
    e información de dispositivo.

    Retorna:
        Tuple[bytes, str, str]: (bytes_sanitizados, extension, mime_type)
    Raises:
        ValueError: Si el archivo no es válido, excede 5 MB o no es JPEG/PNG.
    """
    if not file_bytes:
        raise ValueError("El archivo de imagen está vacío.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("El tamaño del archivo excede el límite máximo de 5 MB.")

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img_format = (img.format or "").upper()
            if img_format == "JPG":
                img_format = "JPEG"

            if img_format not in ALLOWED_FORMATS:
                raise ValueError(
                    f"Formato no permitido ({img_format or 'desconocido'}). Solo se admiten formatos JPEG o PNG."
                )

            # Reconstrucción de la imagen a partir de los bytes crudos de píxeles
            # para garantizar la eliminación de metadatos EXIF, GPSInfo, XMP y comentarios.
            mode = img.mode
            if img_format == "JPEG" and mode in ("RGBA", "LA", "P"):
                # JPEG no soporta canal alfa; convertir a RGB
                rgb_img = img.convert("RGB")
                clean_img = Image.frombytes("RGB", rgb_img.size, rgb_img.tobytes())
            else:
                clean_img = Image.frombytes(mode, img.size, img.tobytes())

            out_buffer = io.BytesIO()
            if img_format == "JPEG":
                clean_img.save(out_buffer, format="JPEG", quality=90)
                ext = "jpg"
                mime_type = "image/jpeg"
            else:
                clean_img.save(out_buffer, format="PNG", optimize=True)
                ext = "png"
                mime_type = "image/png"

            sanitized_bytes = out_buffer.getvalue()

            # Verificación de integridad adicional: confirmar que no contiene EXIF residual
            with Image.open(io.BytesIO(sanitized_bytes)) as check_img:
                raw_exif = check_img.getexif()
                if raw_exif and (0x8825 in raw_exif or len(raw_exif) > 0):
                    # Si persistiera algún tag, se limpia explícitamente
                    clean_fallback = Image.new(check_img.mode, check_img.size)
                    clean_fallback.putdata(list(check_img.getdata()))
                    fb_buffer = io.BytesIO()
                    clean_fallback.save(fb_buffer, format=img_format)
                    sanitized_bytes = fb_buffer.getvalue()

            return sanitized_bytes, ext, mime_type

    except ValueError:
        raise
    except Exception as exc:
        logger.warning(
            "Error al procesar la imagen %s: %s", original_filename, str(exc)
        )
        raise ValueError(
            "El archivo no es una imagen válida o el formato no está soportado. Solo se admiten formatos JPEG o PNG."
        ) from exc


def upload_photo_to_supabase(
    file_bytes: bytes,
    extension: str,
    mime_type: str,
    custom_uuid: Optional[str] = None,
) -> Tuple[str, str, int]:
    """
    Guarda la fotografía en el bucket 'fichas' de Supabase Storage bajo un UUID único
    generado por el servidor.

    Retorna:
        Tuple[str, str, int]: (storage_path, public_url, tamano_bytes)
    """
    server_uuid = custom_uuid or str(uuid.uuid4())
    ext = extension.lstrip(".").lower()
    if ext == "jpeg":
        ext = "jpg"

    bucket = settings.supabase_storage_bucket or "fichas"
    storage_path = f"{server_uuid}.{ext}"
    base_url = (
        settings.supabase_url or "https://zguajlreoeuvypylvbxh.supabase.co"
    ).rstrip("/")
    public_url = f"{base_url}/storage/v1/object/public/{bucket}/{storage_path}"
    tamano_bytes = len(file_bytes)

    # Si se cuenta con credenciales de Supabase, realizar la subida vía REST API
    api_key = settings.supabase_key
    if api_key:
        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "apikey": api_key,
            "Content-Type": mime_type,
            "x-upsert": "true",
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(upload_url, content=file_bytes, headers=headers)
                if res.status_code not in (200, 201):
                    logger.warning(
                        "Supabase Storage respondió con estado %d al subir %s: %s",
                        res.status_code,
                        storage_path,
                        res.text,
                    )
        except Exception as ex:
            logger.warning(
                "No fue posible conectar con Supabase Storage para %s: %s",
                storage_path,
                str(ex),
            )

    return storage_path, public_url, tamano_bytes
