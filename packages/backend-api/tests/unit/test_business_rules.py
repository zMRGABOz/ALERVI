"""
Pruebas de validación de reglas de negocio para Fichas de Inspección y Puntos Críticos.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica:
- RB-10: Restricción de longitud de notas (máximo 500 caracteres).
- RB-5 / CI-1: Ponderaciones de factores deben sumar 1.0.
- Rutas protegidas y códigos de respuesta.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_ficha_inspeccion_max_notes_length_validation(client: TestClient):
    """RB-10: Verifica que una ficha con notas mayores a 500 caracteres sea rechazada con HTTP 422."""
    payload_excedido = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "A" * 501,
        "factores_riesgo_ids": [1],
    }
    response = client.post("/api/v1/inspections", json=payload_excedido)
    assert response.status_code == 422


@pytest.mark.unit
def test_ficha_inspeccion_valida(client: TestClient):
    """RF-5: Verifica la creación exitosa de una ficha de inspección válida."""
    payload_valido = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "Inspección técnica en terreno: señalética visible.",
        "factores_riesgo_ids": [1],
    }
    response = client.post("/api/v1/inspections", json=payload_valido)
    assert response.status_code == 201
    data = response.json()
    assert "id_ficha" in data
    assert data["id_punto"] == 101


@pytest.mark.unit
def test_ponderaciones_factores_suman_uno(client: TestClient):
    """RB-5 / CI-1: Las ponderaciones vigentes de los factores deben sumar exactamente 1.0."""
    response = client.get("/api/v1/factores/ponderaciones")
    assert response.status_code == 200
    data = response.json()
    assert "suma_pesos" in data
    assert pytest.approx(data["suma_pesos"], 0.001) == 1.0
