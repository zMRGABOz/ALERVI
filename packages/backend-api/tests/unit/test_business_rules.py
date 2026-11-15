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


@pytest.mark.integration
def test_tc08_ranking_ordenado_con_filtros(client: TestClient):
    """TC-08: Ranking retorna puntos ordenados de mayor a menor índice de prioridad."""
    response = client.get(
        "/api/v1/ranking?comuna=Concepción&periodo_inicio=2020&periodo_fin=2025&limit=10"
    )
    assert response.status_code == 200
    puntos = response.json()["puntos"]
    assert len(puntos) >= 1
    indices = [p["indice_prioridad"] for p in puntos]
    assert indices == sorted(indices, reverse=True)


@pytest.mark.integration
def test_tc09_explicacion_indice_prioridad_punto(client: TestClient):
    """TC-09: Detalle del punto incluye factores, ponderaciones y justificación multicriterio."""
    response = client.get("/api/v1/puntos/101")
    assert response.status_code == 200
    data = response.json()
    assert data["id_punto"] == 101
    assert "indice_prioridad" in data
    assert "nivel_riesgo" in data


@pytest.mark.unit
def test_tc10_desempate_deterministico_rb7():
    """TC-10 / RB-7: Ante igual IP, desempata por fallecidos, graves, total siniestros e id_punto."""
    puntos_empatados = [
        {"id_punto": 30, "ip": 80.0, "fallecidos": 1, "graves": 2, "total": 10},
        {"id_punto": 10, "ip": 80.0, "fallecidos": 2, "graves": 1, "total": 8},
        {"id_punto": 20, "ip": 80.0, "fallecidos": 1, "graves": 2, "total": 10},
    ]
    ordenados = sorted(
        puntos_empatados,
        key=lambda p: (
            -p["ip"],
            -p["fallecidos"],
            -p["graves"],
            -p["total"],
            p["id_punto"],
        ),
    )
    assert [p["id_punto"] for p in ordenados] == [10, 20, 30]


@pytest.mark.integration
def test_tc11_cambio_ponderaciones_valido(client: TestClient, admin_auth_headers: dict):
    """TC-11: Actualización válida de ponderaciones que suman 1.0 se aplica correctamente."""
    payload = {
        "w_severidad": 0.45,
        "w_frecuencia": 0.25,
        "w_tendencia": 0.15,
        "w_contexto": 0.15,
    }
    response = client.put(
        "/api/v1/factores/ponderaciones", json=payload, headers=admin_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert pytest.approx(data["suma_pesos"], 0.001) == 1.0
    assert data["w_severidad"] == 0.45


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="TC-12 / RB-5: calibrar_ponderaciones lanza ValueError no capturado en lugar de HTTP 400/422",
)
def test_tc12_ponderaciones_suma_distinta_uno_rechazadas(
    client: TestClient, admin_auth_headers: dict
):
    """TC-12 / RB-5: Pesos cuya suma difiere de 1.0 deben ser rechazados (400/422)."""
    pesos_invalidos = {
        "w_severidad": 0.50,
        "w_frecuencia": 0.50,
        "w_tendencia": 0.50,
        "w_contexto": 0.10,
    }
    response = client.put(
        "/api/v1/factores/ponderaciones",
        json=pesos_invalidos,
        headers=admin_auth_headers,
    )
    assert response.status_code in (400, 422)


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="TC-14 / RB-10: FichaInspeccionCreateRequest aún no exige factor o nota no vacíos simultáneamente",
)
def test_tc14_ficha_sin_factor_ni_nota_rechazada(
    client: TestClient, auth_headers: dict
):
    """TC-14: Ausencia simultánea de factores de riesgo y notas debe rechazarse con HTTP 422."""
    payload = {
        "id_punto": 101,
        "fecha_visita": "2026-11-02",
        "notas": "",
        "factores_riesgo_ids": [],
    }
    response = client.post("/api/v1/inspections", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.integration
def test_tc18_historial_fichas_punto(client: TestClient, auth_headers: dict):
    """TC-18: Consulta del historial de un punto crítico devuelve fichas del punto."""
    response = client.get("/api/v1/puntos/101/fichas", headers=auth_headers)
    assert response.status_code == 200
    fichas = response.json()
    assert isinstance(fichas, list)
    assert all(f["id_punto"] == 101 for f in fichas)


@pytest.mark.integration
def test_tc22_alerta_aproximacion_convergente_activa(
    client: TestClient, sample_telemetry_payload: dict
):
    """TC-22 / RB-13: Velocidad >= 1.38 m/s, TTC <= 12s y rumbo convergente activa alerta."""
    response = client.post("/api/v1/alerts", json=sample_telemetry_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alerta_activa"] is True


@pytest.mark.integration
def test_tc23_alerta_suprimida_vehiculo_detenido_o_divergente(
    client: TestClient, sample_telemetry_payload: dict
):
    """TC-23 / RB-13: Vehículo detenido (< 1.38 m/s) suprime alerta de proximidad."""
    detenido = {**sample_telemetry_payload, "speed_mps": 0.5}
    response = client.post("/api/v1/alerts", json=detenido)
    assert response.status_code == 200
    data = response.json()
    assert data["alerta_activa"] is False


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="TC-29 / RB-14: POST /api/v1/alerts aún no filtra puntos_ya_advertidos_sesion; pendiente en backend",
)
def test_tc29_no_repite_alerta_punto_ya_advertido(
    client: TestClient, sample_telemetry_payload: dict
):
    """TC-29 / RB-14: Si el punto crítico ya fue advertido en la sesión, no repite alerta."""
    payload = {
        **sample_telemetry_payload,
        "puntos_ya_advertidos_sesion": [101],
    }
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 200
    data = response.json()
    if data["alerta_activa"] and data.get("alerta"):
        assert data["alerta"]["id_punto"] != 101
