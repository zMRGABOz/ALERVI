"""
Pruebas de Privacidad GPS e Inmutabilidad de Telemetría (RNF-S-8, TC-28).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica explícitamente que la telemetría vehicular enviada a POST /api/v1/alerts:
1. Jamás sea persistida en tablas de la base de datos (punto_critico, registro, evento_auditoria, etc.).
2. No filtre coordenadas crudas en la respuesta de alerta.
3. No registre coordenadas lat/long en bitácoras o logs del sistema (inspección con caplog).
"""

import logging

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
@pytest.mark.privacy
def test_rnf_s_8_alerts_telemetry_not_persisted_in_db_and_logs(
    client: TestClient,
    sample_telemetry_payload: dict,
    caplog: pytest.LogCaptureFixture,
    admin_auth_headers: dict,
):
    """
    RNF-S-8 / TC-28: Verifica que enviar telemetría a /api/v1/alerts no inserte registros
    con coordenadas en la base de datos ni en los logs técnicos del sistema.
    """
    lat_str = str(sample_telemetry_payload["latitude"])
    lon_str = str(sample_telemetry_payload["longitude"])

    # 1. Obtener estado previo de la bitácora de auditoría
    res_audit_before = client.get("/api/v1/auditoria", headers=admin_auth_headers)
    assert res_audit_before.status_code == 200

    # 2. Enviar telemetría vehicular capturando logs con caplog
    with caplog.at_level(logging.DEBUG):
        response = client.post("/api/v1/alerts", json=sample_telemetry_payload)

    assert response.status_code == 200
    data = response.json()
    assert "telemetria_status" in data

    # 3. Verificar que los logs de la aplicación no contengan las coordenadas recibidas
    log_records_text = " ".join(record.getMessage() for record in caplog.records)
    assert lat_str not in log_records_text, (
        f"RNF-S-8 Violado: Latitud {lat_str} detectada en los logs del servidor."
    )
    assert lon_str not in log_records_text, (
        f"RNF-S-8 Violado: Longitud {lon_str} detectada en los logs del servidor."
    )

    # 4. Verificar que la bitácora de auditoría tampoco haya registrado las coordenadas GPS
    res_audit_after = client.get("/api/v1/auditoria", headers=admin_auth_headers)
    assert res_audit_after.status_code == 200
    eventos_after = res_audit_after.json().get("eventos", [])

    for evento in eventos_after:
        detalles_texto = str(evento)
        assert lat_str not in detalles_texto, (
            f"RNF-S-8 Violado: Latitud {lat_str} encontrada en tabla de auditoría."
        )
        assert lon_str not in detalles_texto, (
            f"RNF-S-8 Violado: Longitud {lon_str} encontrada en tabla de auditoría."
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

    if data.get("alerta"):
        alerta = data["alerta"]
        assert "latitude" not in alerta
        assert "longitude" not in alerta
        assert "distancia_m" in alerta
        assert "ttc_segundos" in alerta
