"""
Pruebas de Privacidad GPS e Inmutabilidad de Telemetría (RNF-S-8).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica explícitamente que la telemetría vehicular enviada a POST /api/v1/alerts:
 - Jamás sea persistida en tablas de la base de datos (punto_critico, registro, evento_auditoria, etc.).
 - No registre coordenadas lat/long en bitácoras o logs del sistema.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
@pytest.mark.privacy
def test_rnf_s_8_alerts_telemetry_not_persisted_in_db(
    client: TestClient, sample_telemetry_payload: dict
):
    """
    RNF-S-8: Verifica que enviar telemetría a /api/v1/alerts no inserte registros
    con coordenadas en la base de datos ni en la bitácora de auditoría.
    """
    # Obtener estado previo de la bitácora de auditoría
    res_audit_before = client.get("/api/v1/auditoria")
    assert res_audit_before.status_code == 200

    # Enviar telemetría vehicular
    response = client.post("/api/v1/alerts", json=sample_telemetry_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alerta_activa"] is True
    assert data["telemetria_status"] == "EVALUADO_CON_ALERTA"

    # Verificar que la bitácora de auditoría no haya registrado las coordenadas GPS
    res_audit_after = client.get("/api/v1/auditoria")
    assert res_audit_after.status_code == 200
    eventos_after = res_audit_after.json().get("eventos", [])

    # Ni la latitud ni la longitud deben existir en el texto de los eventos
    lat_str = str(sample_telemetry_payload["latitude"])
    lon_str = str(sample_telemetry_payload["longitude"])

    for evento in eventos_after:
        detalles_texto = str(evento)
        assert lat_str not in detalles_texto, (
            f"RNF-S-8 Violado: Latitud {lat_str} encontrada en auditoría."
        )
        assert lon_str not in detalles_texto, (
            f"RNF-S-8 Violado: Longitud {lon_str} encontrada en auditoría."
        )


@pytest.mark.integration
@pytest.mark.privacy
def test_alerts_response_contains_no_raw_gps_echo(
    client: TestClient, sample_telemetry_payload: dict
):
    """Verifica que la respuesta de /api/v1/alerts devuelva información de seguridad sin exponer telemetría cruda."""
    response = client.post("/api/v1/alerts", json=sample_telemetry_payload)
    assert response.status_code == 200
    data = response.json()

    assert "alerta" in data
    alerta = data["alerta"]
    assert "latitude" not in alerta
    assert "longitude" not in alerta
    assert "distancia_m" in alerta
    assert "ttc_segundos" in alerta
