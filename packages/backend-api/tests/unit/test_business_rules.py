"""
Pruebas de validación de reglas de negocio para Fichas de Inspección y Puntos Críticos.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica:
- RB-10 / TC-13: Creación de ficha válida con factor y/o notas.
- RB-10 / TC-14: Restricción de longitud de notas (máximo 500 caracteres).
- RB-10 / TC-14: Rechazo de fecha de visita futura (> HOY) (Defecto D-2).
- RB-5 / CI-1: Ponderaciones de factores deben sumar 1.0.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_ficha_inspeccion_max_notes_length_validation(
    client: TestClient, auth_headers: dict
):
    """RB-10: Verifica que una ficha con notas mayores a 500 caracteres sea rechazada con HTTP 422."""
    payload_excedido = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "A" * 501,
        "factores_riesgo_ids": [1],
    }
    response = client.post(
        "/api/v1/inspections", json=payload_excedido, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.integration
def test_ficha_inspeccion_valida(client: TestClient, auth_headers: dict):
    """RF-5 / TC-13: Verifica la creación exitosa de una ficha de inspección válida."""
    payload_valido = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Inspección técnica en terreno: señalética visible.",
        "factores_riesgo_ids": [1],
    }
    response = client.post(
        "/api/v1/inspections", json=payload_valido, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert "id_ficha" in data
    assert data["id_punto"] == 101


@pytest.mark.integration
def test_tc14_ficha_fecha_futura_rechazada(client: TestClient, auth_headers: dict):
    """TC-14 / RB-10: Verifica que una fecha de visita futura sea rechazada con HTTP 422."""
    payload_futuro = {
        "id_punto": 101,
        "fecha_visita": "2099-01-01",
        "notas": "Visita en fecha futura imposible.",
        "factores_riesgo_ids": [1],
    }
    response = client.post(
        "/api/v1/inspections", json=payload_futuro, headers=auth_headers
    )
    assert response.status_code == 422, (
        f"Fecha futura 2099-01-01 fue aceptada con código {response.status_code}"
    )


@pytest.mark.integration
def test_ponderaciones_factores_suman_uno(client: TestClient):
    """RB-5 / CI-1: Las ponderaciones vigentes de los factores deben sumar exactamente 1.0."""
    response = client.get("/api/v1/factores/ponderaciones")
    assert response.status_code == 200
    data = response.json()
    assert "suma_pesos" in data
    assert pytest.approx(data["suma_pesos"], 0.001) == 1.0
