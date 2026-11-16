"""
Pruebas de Ingesta Batch y Capa Pública Geoespacial (RF-1, RF-2, TC-01, TC-02, TC-05 a TC-07).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica:
- Respuesta explícita de ingesta HTTP no implementada y validación de estructura.
- Consulta pública GeoJSON sin autenticación y sin exponer fichas internas (TC-05).
- Manejo de zona sin puntos críticos y resiliencia ante fallas espaciales (TC-06, TC-07).
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.models.db_models import Registro
from app.services import spatial_service


@pytest.mark.integration
def test_tc01_carga_registros_validos(
    client: TestClient, admin_auth_headers: dict, db_session
):
    """La ruta HTTP pendiente responde 501 y no simula registros procesados."""
    before = db_session.query(Registro).count()
    payload = {
        "fuente": "CONASET_ARCGIS",
        "anio": 2024,
        "descripcion": "Carga de prueba TC-01",
        "registros": [
            {
                "latitud": -36.8271,
                "longitud": -73.0543,
                "cantidad_siniestros": 5,
            }
        ],
    }
    response = client.post("/api/v1/cargas", json=payload, headers=admin_auth_headers)
    assert response.status_code == 501
    assert "cargadores" in response.json()["detail"]
    assert db_session.query(Registro).count() == before


@pytest.mark.integration
def test_tc02_carga_estructura_incompatible_rechazada(
    client: TestClient, admin_auth_headers: dict
):
    """TC-02: Estructura incompatible o campos requeridos faltantes retorna HTTP 422."""
    payload_invalido = {
        "fuente": "CONASET_ARCGIS",
        "registros": "formato_invalido",
    }
    response = client.post(
        "/api/v1/cargas", json=payload_invalido, headers=admin_auth_headers
    )
    assert response.status_code == 422


@pytest.mark.integration
def test_tc05_consulta_publica_sin_autenticacion_y_sin_fichas_internas(
    client: TestClient,
):
    """TC-05: GET /api/v1/publico/riesgo funciona sin token y no expone fichas internas."""
    response = client.get("/api/v1/publico/riesgo?comuna=Concepción")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert isinstance(data["features"], list)
    for feature in data["features"]:
        props = feature.get("properties", {})
        assert "notas" not in props
        assert "fichas" not in props


@pytest.mark.integration
def test_tc06_consulta_publica_comuna_sin_puntos_no_falla(client: TestClient):
    """TC-06: Consulta sin puntos disponibles en la zona responde HTTP 200 con GeoJSON válido."""
    response = client.get("/api/v1/publico/riesgo?comuna=ComunaInexistente999")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert isinstance(data["features"], list)
    assert data["features"] == []


@pytest.mark.unit
def test_tc07_resiliencia_ante_falla_consulta_espacial():
    """TC-07: Una falla espacial revierte la transacción y responde 503."""
    mock_db = MagicMock()
    mock_db.query.side_effect = OperationalError(
        "SELECT", {}, RuntimeError("Falla de conexión PostGIS simulada")
    )

    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_capa_riesgo_publico(mock_db, comuna="Concepción")
    assert error.value.status_code == 503
    mock_db.rollback.assert_called_once()
