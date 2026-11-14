"""
Pruebas unitarias y de integración para sanitización EXIF y subida a Supabase Storage.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Criterio de aceptación:
- Fotos sin metadatos GPS residuales.
- Fotos guardadas en la nube bajo UUID único generado por el servidor en el bucket 'fichas'.
- Cumplimiento de reglas de negocio RB-10 (máx 3 fotos por ficha, máx 5 MB, formato JPEG/PNG)
  y RNF-S-7.
"""

import io
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from PIL import Image, PngImagePlugin

from app.core.config import settings
from app.services import crud_service, storage_service


def _create_jpeg_with_gps() -> bytes:
    """Genera una imagen JPEG válida con metadatos GPS e información de cámara."""
    img = Image.new("RGB", (120, 120), color=(200, 50, 50))
    exif = img.getexif()

    # Tag GPSInfo: 0x8825 (34853)
    gps_ifd = exif.get_ifd(0x8825)
    gps_ifd[1] = "S"  # LatitudeRef
    gps_ifd[2] = 36.82  # Latitude
    gps_ifd[3] = "W"  # LongitudeRef
    gps_ifd[4] = 73.05  # Longitude
    exif[0x8825] = gps_ifd

    # Tags de dispositivo
    exif[0x010F] = "Nikon Camera Corp"  # Make
    exif[0x0110] = "D850 Digital SLR"  # Model

    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _create_png_with_metadata() -> bytes:
    """Genera una imagen PNG con información de texto auxiliar."""
    img = Image.new("RGB", (80, 80), color=(30, 150, 80))
    meta = PngImagePlugin.PngInfo()
    meta.add_text("Location", "Lat: -36.82, Lon: -73.05")
    meta.add_text("Camera", "Sony Alpha 7")

    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=meta)
    return buf.getvalue()


def test_sanitize_jpeg_removes_gps_and_exif():
    """Verifica que el sanitizador elimine completamente metadatos GPS y de cámara en JPEG."""
    raw_jpeg = _create_jpeg_with_gps()

    # Confirmar presencia de GPS antes de la sanitización
    with Image.open(io.BytesIO(raw_jpeg)) as before_img:
        before_exif = before_img.getexif()
        assert 0x8825 in before_exif, (
            "El archivo original debe contener el bloque GPSInfo"
        )
        gps_data = before_exif.get_ifd(0x8825)
        assert gps_data.get(1) == "S"

    # Sanitizar
    sanitized_bytes, ext, mime = storage_service.sanitize_image_exif(
        raw_jpeg, "foto_evidencia.jpg"
    )

    assert ext == "jpg"
    assert mime == "image/jpeg"
    assert len(sanitized_bytes) > 0

    # Verificar ausencia total de GPS y metadatos en la imagen sanitizada
    with Image.open(io.BytesIO(sanitized_bytes)) as after_img:
        after_exif = after_img.getexif()
        assert 0x8825 not in after_exif, (
            "La imagen sanitizada NO debe tener bloque GPSInfo"
        )
        assert len(after_exif.get_ifd(0x8825)) == 0, (
            "No deben existir tags GPS residuales"
        )
        assert 0x010F not in after_exif, (
            "No debe incluir información del fabricante de la cámara"
        )
        assert 0x0110 not in after_exif, "No debe incluir modelo del dispositivo"
        assert len(after_exif) == 0, "La imagen sanitizada debe tener 0 tags EXIF"


def test_sanitize_png_removes_metadata():
    """Verifica que el sanitizador elimine metadatos textuales y perfiles en PNG."""
    raw_png = _create_png_with_metadata()

    # Confirmar presencia antes
    with Image.open(io.BytesIO(raw_png)) as before_img:
        assert "Location" in before_img.info

    # Sanitizar
    sanitized_bytes, ext, mime = storage_service.sanitize_image_exif(
        raw_png, "foto.png"
    )

    assert ext == "png"
    assert mime == "image/png"

    # Verificar ausencia después
    with Image.open(io.BytesIO(sanitized_bytes)) as after_img:
        assert "Location" not in after_img.info
        assert "Camera" not in after_img.info


def test_sanitize_rejects_empty_and_corrupt_files():
    """Verifica que archivos vacíos o corruptos lancen ValueError descriptivo."""
    with pytest.raises(ValueError, match="vacío"):
        storage_service.sanitize_image_exif(b"", "vacio.jpg")

    with pytest.raises(ValueError, match="no es una imagen válida"):
        storage_service.sanitize_image_exif(
            b"contenido-no-binario-de-imagen", "fake.jpg"
        )


def test_sanitize_rejects_disallowed_formats():
    """Verifica que solo se admitan formatos JPEG y PNG (RB-10 / RNF-S-7)."""
    # Crear un GIF
    gif_img = Image.new("RGB", (50, 50), color="blue")
    buf = io.BytesIO()
    gif_img.save(buf, format="GIF")

    with pytest.raises(ValueError, match="Solo se admiten formatos JPEG o PNG"):
        storage_service.sanitize_image_exif(buf.getvalue(), "animacion.gif")


def test_sanitize_rejects_oversized_file():
    """Verifica rechazo de archivos que superen los 5 MB (RB-10)."""
    oversized = b"X" * (5 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="excede el límite máximo de 5 MB"):
        storage_service.sanitize_image_exif(oversized, "pesada.jpg")


def test_upload_photo_to_supabase_uuid_and_bucket_naming():
    """Verifica que el nombre guardado sea un UUIDv4 generado por el servidor y apunte al bucket 'fichas'."""
    raw_jpeg = _create_jpeg_with_gps()
    clean_bytes, ext, mime = storage_service.sanitize_image_exif(raw_jpeg)

    storage_path, public_url, size = storage_service.upload_photo_to_supabase(
        clean_bytes, ext, mime
    )

    # Validar que storage_path es '<uuid>.jpg'
    stem, extension = storage_path.rsplit(".", 1)
    assert extension == "jpg"
    parsed_uuid = uuid.UUID(stem)
    assert str(parsed_uuid) == stem
    assert parsed_uuid.version == 4, (
        "Debe ser un UUID versión 4 generado por el servidor"
    )

    # Validar URL pública hacia el bucket fichas
    assert "/storage/v1/object/public/fichas/" in public_url
    assert public_url.endswith(storage_path)
    assert size == len(clean_bytes)


def test_upload_photo_to_supabase_rest_call():
    """Verifica llamada HTTP REST a Supabase Storage cuando hay credenciales activas."""
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200

    with (
        patch("httpx.Client.post", return_value=mock_post_res) as mock_post,
        patch.object(settings, "supabase_key", "test-service-key"),
        patch.object(settings, "supabase_url", "https://xyzproject.supabase.co"),
        patch.object(settings, "supabase_storage_bucket", "fichas"),
    ):
        raw_jpeg = _create_jpeg_with_gps()
        clean_bytes, ext, mime = storage_service.sanitize_image_exif(raw_jpeg)
        test_uuid = str(uuid.uuid4())

        path, url, size = storage_service.upload_photo_to_supabase(
            clean_bytes, ext, mime, custom_uuid=test_uuid
        )

        assert path == f"{test_uuid}.jpg"
        assert (
            url
            == f"https://xyzproject.supabase.co/storage/v1/object/public/fichas/{test_uuid}.jpg"
        )

        mock_post.assert_called_once()
        call_url = mock_post.call_args[0][0]
        call_headers = mock_post.call_args[1]["headers"]
        assert (
            call_url
            == f"https://xyzproject.supabase.co/storage/v1/object/fichas/{test_uuid}.jpg"
        )
        assert call_headers["apikey"] == "test-service-key"
        assert call_headers["Authorization"] == "Bearer test-service-key"
        assert call_headers["Content-Type"] == "image/jpeg"


def test_crud_agregar_fotografia_limite_3_fotos_rb10():
    """Verifica que intentar agregar una 4ta fotografía sea rechazado con 400 (RB-10)."""
    mock_db = MagicMock()
    # Simular que ya existen 3 fotografías asociadas a la ficha
    mock_db.query.return_value.filter.return_value.count.return_value = 3

    with pytest.raises(HTTPException) as exc_info:
        crud_service.agregar_fotografia_ficha(
            mock_db, id_ficha=10, file_bytes=_create_jpeg_with_gps()
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "La ficha admite un máximo de 3 fotografías."


def test_crud_agregar_fotografia_rb11_inspector_ajeno_rechazado():
    """Verifica que un inspector que no es autor no pueda adjuntar fotos (RB-11)."""
    mock_db = MagicMock()
    mock_ficha = MagicMock()
    mock_ficha.id_ficha = 10
    mock_ficha.id_usuario = 2  # Inspector autor es el 2
    mock_ficha.usuario.correo = "inspector@alervi.test"
    mock_db.query.return_value.filter.return_value.first.return_value = mock_ficha
    mock_db.query.return_value.filter.return_value.count.return_value = 1

    # Inspector diferente intentando adjuntar foto
    foreign_user = {"id_usuario": 99, "correo": "otro@alervi.test", "rol": "inspector"}

    with pytest.raises(HTTPException) as exc_info:
        crud_service.agregar_fotografia_ficha(
            mock_db,
            id_ficha=10,
            file_bytes=_create_jpeg_with_gps(),
            current_user=foreign_user,
        )

    assert exc_info.value.status_code == 403
    assert (
        "solo el inspector autor de la ficha puede adjuntar fotos"
        in exc_info.value.detail
    )


def test_endpoint_upload_foto_multipart_integration(client, auth_headers):
    """Verifica la subida de una foto con GPS al endpoint /api/v1/inspections/{id}/fotos."""
    # 1. Crear ficha de inspección
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Inspección de prueba para subida de fotos.",
        "factores_riesgo_ids": [1],
    }
    res_ficha = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    assert res_ficha.status_code == 201
    id_ficha = res_ficha.json()["id_ficha"]

    # 2. Generar foto con GPS
    raw_jpeg = _create_jpeg_with_gps()

    # 3. Subir foto mediante multipart/form-data
    files = {"foto": ("evidencia_gps.jpg", raw_jpeg, "image/jpeg")}
    res_upload = client.post(
        f"/api/v1/inspections/{id_ficha}/fotos", files=files, headers=auth_headers
    )
    assert res_upload.status_code == 201
    data = res_upload.json()

    assert data["id_ficha"] == id_ficha
    assert "ruta" in data
    # Comprobar que ruta es un UUIDv4
    uuid_part = data["ruta"].split(".")[0]
    parsed_uuid = uuid.UUID(uuid_part)
    assert parsed_uuid.version == 4
    assert "/fichas/" in data["url"]
    assert data["tamano_bytes"] > 0
    assert data["fecha_subida"] is not None


def test_endpoint_upload_foto_alias_route(client, auth_headers):
    """Verifica que el alias sin prefijo /inspections/{id}/fotos también funcione."""
    # Crear ficha limpia para garantizar idempotencia en ejecuciones repetidas
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Inspección de prueba para ruta alias.",
        "factores_riesgo_ids": [1],
    }
    res_ficha = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    id_ficha = res_ficha.json()["id_ficha"] if res_ficha.status_code == 201 else 15

    raw_png = _create_png_with_metadata()
    files = {"foto": ("captura.png", raw_png, "image/png")}
    res_alias = client.post(
        f"/inspections/{id_ficha}/fotos", files=files, headers=auth_headers
    )
    assert res_alias.status_code == 201
    data = res_alias.json()
    assert data["ruta"].endswith(".png")
    assert uuid.UUID(data["ruta"].split(".")[0]).version == 4


def test_endpoint_upload_foto_rechaza_formato_invalido(client, auth_headers):
    """Verifica rechazo con 400 si se envía un archivo no admitido (ej. texto plano)."""
    files = {"foto": ("documento.txt", b"Texto no binario de imagen", "text/plain")}
    res = client.post("/api/v1/inspections/15/fotos", files=files, headers=auth_headers)
    assert res.status_code == 400
    assert "Solo se admiten formatos JPEG o PNG" in res.json()["detail"]


def test_endpoint_upload_foto_rechaza_archivo_vacio_0_bytes(client, auth_headers):
    """Verifica rechazo con 400 si se envía un archivo de imagen de 0 bytes."""
    # Crear una ficha válida
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Ficha para prueba de archivo vacío.",
        "factores_riesgo_ids": [1],
    }
    res_ficha = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    assert res_ficha.status_code == 201
    id_ficha = res_ficha.json()["id_ficha"]

    files = {"foto": ("corrupto.jpg", b"", "image/jpeg")}
    res = client.post(
        f"/api/v1/inspections/{id_ficha}/fotos", files=files, headers=auth_headers
    )
    assert res.status_code == 400
    assert "El archivo de imagen está vacío" in res.json()["detail"]


def test_endpoint_upload_foto_ficha_inexistente_404(client, auth_headers):
    """Verifica que subir una foto a una ficha inexistente devuelva 404 Not Found en BD activa."""
    from app.core.database import get_db
    from app.main import app

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        raw_jpeg = _create_jpeg_with_gps()
        files = {"foto": ("evidencia.jpg", raw_jpeg, "image/jpeg")}
        res = client.post(
            "/api/v1/inspections/999999/fotos", files=files, headers=auth_headers
        )
        assert res.status_code == 404
        assert "no encontrada" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_crud_agregar_fotografia_ficha_inexistente_raises_404():
    """Verifica que si la ficha no existe en BD real, crud_service levante 404."""
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        crud_service.agregar_fotografia_ficha(
            mock_db, id_ficha=999999, file_bytes=_create_jpeg_with_gps()
        )

    assert exc_info.value.status_code == 404
    assert "no encontrada" in exc_info.value.detail.lower()


def test_upload_photo_to_supabase_error_raises_ioerror():
    """Verifica que un fallo HTTP en Supabase Storage levante IOError cuando hay credenciales."""
    mock_post_res = MagicMock()
    mock_post_res.status_code = 401
    mock_post_res.text = "Unauthorized: Invalid Service Key"

    with (
        patch("httpx.Client.post", return_value=mock_post_res),
        patch.object(settings, "supabase_key", "invalid-key"),
        patch.object(settings, "supabase_url", "https://xyzproject.supabase.co"),
        patch.object(settings, "supabase_storage_bucket", "fichas"),
    ):
        raw_jpeg = _create_jpeg_with_gps()
        clean_bytes, ext, mime = storage_service.sanitize_image_exif(raw_jpeg)
        with pytest.raises(IOError, match="Supabase Storage respondió con estado HTTP 401"):
            storage_service.upload_photo_to_supabase(clean_bytes, ext, mime)


def test_crud_agregar_fotografia_supabase_error_returns_502(client, auth_headers):
    """Verifica que fallo en Supabase Storage durante la subida de evidencia retorne 502 Bad Gateway."""
    # Crear ficha válida
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Ficha para prueba de error en Supabase Storage.",
        "factores_riesgo_ids": [1],
    }
    res_ficha = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    assert res_ficha.status_code == 201
    id_ficha = res_ficha.json()["id_ficha"]

    raw_jpeg = _create_jpeg_with_gps()
    files = {"foto": ("evidencia.jpg", raw_jpeg, "image/jpeg")}

    with patch(
        "app.services.storage_service.upload_photo_to_supabase",
        side_effect=IOError("Supabase Storage timeout de conexión"),
    ):
        res = client.post(
            f"/api/v1/inspections/{id_ficha}/fotos", files=files, headers=auth_headers
        )
        assert res.status_code == 502
        assert "servicio de almacenamiento" in res.json()["detail"].lower()

