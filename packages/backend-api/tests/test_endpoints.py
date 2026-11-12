"""
Suite de pruebas de integracion para ALERVI Backend API mediante pytest.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica el cumplimiento de todos los endpoints y contratos:
1. Mapeo de tablas de base de datos en SQLAlchemy Base.metadata
2. CORS (http://localhost:3000)
3. POST  /api/v1/auth/login
4. GET, POST, PATCH /api/v1/usuarios y /api/v1/usuarios/{id}
5. POST  /api/v1/cargas
6. GET   /api/v1/publico/riesgo
7. GET   /api/v1/ranking
8. GET   /api/v1/puntos/{id_punto}
9. GET, POST, PATCH /api/v1/factores y GET, PUT /api/v1/factores/ponderaciones
10. POST, GET, PATCH /api/v1/inspections y /api/v1/inspections/{id_ficha}
11. POST /api/v1/inspections/{id_ficha}/fotos
12. GET  /api/v1/puntos/{id_punto}/fichas
13. POST /api/v1/alerts
14. GET  /api/v1/auditoria
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.models import Base

client = TestClient(app)


def test_orm_models_tables_mapped():
    """Verifica que los modelos ORM de SQLAlchemy mapean las tablas del esquema SQL."""
    tables = set(Base.metadata.tables.keys())
    expected_tables = {
        "comuna",
        "punto_critico",
        "registro",
        "elemento_urbano",
        "usuario",
        "factor_riesgo",
        "ficha_inspeccion",
        "registra",
        "fotografia",
        "evento_auditoria",
    }
    for table in expected_tables:
        assert table in tables, f"La tabla {table} debe estar mapeada en Base.metadata"


def test_cors_header():
    """Verifica que el middleware CORS responde al origen http://localhost:3000."""
    response = client.options(
        "/api/v1/publico/riesgo",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    )


def test_auth_login():
    """Verifica inicio de sesion (POST /api/v1/auth/login)."""
    payload = {
        "correo": "inspector@alervi.test",
        "password": "Dev-2026-ALERVI",
        "codigo_mfa": "482910",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 28800
    assert data["usuario"]["rol"] == "inspector"


def test_usuarios_crud(admin_auth_headers: dict):
    """Verifica gestion de usuarios (GET, POST, PATCH /api/v1/usuarios)."""
    # Listar
    res_list = client.get("/api/v1/usuarios", headers=admin_auth_headers)
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1

    # Crear
    unique_correo = f"nuevo_{uuid.uuid4().hex[:8]}@alervi.test"
    res_create = client.post(
        "/api/v1/usuarios",
        json={
            "correo": unique_correo,
            "clave": "PasswordSegura2026*",
            "rol": "inspector",
        },
        headers=admin_auth_headers,
    )
    assert res_create.status_code == 201
    assert res_create.json()["correo"] == unique_correo
    created_id = res_create.json()["id_usuario"]

    # Detalle
    res_get = client.get(f"/api/v1/usuarios/{created_id}", headers=admin_auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["id_usuario"] == created_id

    # Modificar (modifica el usuario recién creado para no contaminar al inspector seed)
    res_patch = client.patch(
        f"/api/v1/usuarios/{created_id}",
        json={"activo": False},
        headers=admin_auth_headers,
    )
    assert res_patch.status_code == 200
    assert not res_patch.json()["activo"]


def test_cargas_batch():
    """Verifica ingesta batch de siniestros CONASET (POST /api/v1/cargas)."""
    payload = {
        "fuente": "CONASET_ARCGIS",
        "anio": 2024,
        "descripcion": "Lote pruebas",
        "registros": [
            {
                "latitud": -36.8271,
                "longitud": -73.0543,
                "cantidad_siniestros": 10,
            }
        ],
    }
    response = client.post("/api/v1/cargas", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["anio"] == 2024
    assert "total_procesados" in data


def test_publico_riesgo_geojson():
    """Verifica capa de riesgo GeoJSON (GET /api/v1/publico/riesgo)."""
    response = client.get("/api/v1/publico/riesgo?comuna=Concepción")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0

    primera_feature = data["features"][0]
    assert primera_feature["type"] == "Feature"
    assert primera_feature["geometry"]["type"] == "Point"
    assert len(primera_feature["geometry"]["coordinates"]) == 2
    assert "id_punto" in primera_feature["properties"]


def test_ranking():
    """Verifica calculo de ranking multicriterio (GET /api/v1/ranking)."""
    response = client.get("/api/v1/ranking?comuna=Concepción&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "total_puntos" in data
    assert "puntos" in data
    assert len(data["puntos"]) > 0

    # Consulta con anio específico
    res_anio = client.get("/api/v1/ranking?anio=2024")
    assert res_anio.status_code == 200
    assert res_anio.json()["periodo"] == "2024"

    # Validación: anio con intervalo contradictorio retorna 400
    res_bad = client.get(
        "/api/v1/ranking?anio=2024&periodo_inicio=2021&periodo_fin=2023"
    )
    assert res_bad.status_code == 400
    assert "contradictorios" in res_bad.json()["detail"]

    # Validación: periodo_inicio > periodo_fin retorna 400
    res_range_bad = client.get("/api/v1/ranking?periodo_inicio=2025&periodo_fin=2020")
    assert res_range_bad.status_code == 400
    assert "mayor" in res_range_bad.json()["detail"]


def test_detalle_punto_tecnico():
    """Verifica detalle tecnico de un punto critico (GET /api/v1/puntos/{id_punto})."""
    response = client.get("/api/v1/puntos/101")
    assert response.status_code == 200
    data = response.json()
    assert data["id_punto"] == 101
    assert "historico_anual" in data
    assert "desglose_scoring" in data


def test_factores_y_ponderaciones():
    """Verifica catalogo de factores y calibracion de ponderaciones."""
    # Listar factores
    res_list = client.get("/api/v1/factores")
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    # Crear factor
    res_create = client.post(
        "/api/v1/factores",
        json={"nombre": "Nuevo factor de prueba", "descripcion": "Descripcion corta"},
    )
    assert res_create.status_code == 201

    # Modificar factor
    res_patch = client.patch(
        "/api/v1/factores/1",
        json={"activo": False},
    )
    assert res_patch.status_code == 200

    # Consultar ponderaciones
    res_pond = client.get("/api/v1/factores/ponderaciones")
    assert res_pond.status_code == 200
    assert res_pond.json()["suma_pesos"] == 1.0

    # Calibrar ponderaciones
    res_update_pond = client.put(
        "/api/v1/factores/ponderaciones",
        json={
            "w_severidad": 0.40,
            "w_frecuencia": 0.20,
            "w_tendencia": 0.20,
            "w_contexto": 0.20,
        },
    )
    assert res_update_pond.status_code == 200
    assert res_update_pond.json()["w_severidad"] == 0.40


def test_inspections_y_fotos(auth_headers: dict):
    """Verifica registro, detalle, edicion y fotos de inspecciones."""
    # Crear ficha valida
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Inspección técnica en terreno.",
        "factores_riesgo_ids": [1],
    }
    res_create = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    assert res_create.status_code == 201
    id_ficha = res_create.json()["id_ficha"]

    # Validacion restriccion 500 caracteres (SQL CHECK)
    res_invalid = client.post(
        "/api/v1/inspections",
        json={"id_punto": 101, "fecha_visita": "2026-11-02", "notas": "X" * 501},
        headers=auth_headers,
    )
    assert res_invalid.status_code == 422

    # Detalle ficha
    res_get = client.get(f"/api/v1/inspections/{id_ficha}")
    assert res_get.status_code == 200

    # Editar ficha (PATCH)
    res_patch = client.patch(
        f"/api/v1/inspections/{id_ficha}",
        json={"notas": "Notas actualizadas del inspector."},
        headers=auth_headers,
    )
    assert res_patch.status_code == 200

    # Adjuntar foto (POST /inspections/{id}/fotos)
    res_foto = client.post(
        f"/api/v1/inspections/{id_ficha}/fotos", headers=auth_headers
    )
    assert res_foto.status_code == 201
    assert "ruta" in res_foto.json()

    # Historial de fichas por punto (GET /puntos/{id}/fichas)
    res_historial = client.get("/api/v1/puntos/101/fichas")
    assert res_historial.status_code == 200
    assert isinstance(res_historial.json(), list)


def test_alerts_evaluacion():
    """Verifica evaluacion cinematica (POST /api/v1/alerts)."""
    payload = {
        "session_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "latitude": -36.8285,
        "longitude": -73.0550,
        "speed_mps": 13.88,
        "heading_degrees": 45.0,
        "accuracy_m": 8.5,
        "timestamp": "2026-11-03T02:30:00Z",
    }
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alerta_activa"] is True
    assert data["telemetria_status"] == "EVALUADO_CON_ALERTA"


def test_auditoria(admin_auth_headers: dict):
    """Verifica consulta de bitacora inmutable (GET /api/v1/auditoria)."""
    response = client.get("/api/v1/auditoria", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["eventos"]) >= 1
