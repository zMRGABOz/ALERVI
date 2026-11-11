"""
Pruebas de Seguridad, Autenticación y Autorización (RF-9, RNF-S-1, TC-30, TC-31).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica:
- Login exitoso para roles funcionario/administrador (RF-9, TC-30).
- Formato del token Bearer JWT y tiempo de expiración (8 horas = 28800s).
- Validación de esquemas y rechazo de payloads inválidos.
- Rechazo de contraseñas incorrectas (TC-30, D-3).
- Denegación de acceso a rutas protegidas sin sesión o token (TC-31, D-1).
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_login_exitoso_inspector(client: TestClient):
    """RF-9 / TC-30: Verifica autenticación exitosa para inspector retornando token Bearer."""
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


@pytest.mark.integration
def test_login_exitoso_administrador(client: TestClient):
    """RF-9 / TC-30: Verifica autenticación exitosa para usuario administrador."""
    payload = {
        "correo": "admin@alervi.test",
        "password": "Dev-2026-ALERVI",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["usuario"]["rol"] == "administrador"
    assert data["usuario"]["id_usuario"] == 1


@pytest.mark.unit
def test_login_payload_invalido_rechazado(client: TestClient):
    """RNF-S-1: Verifica que peticiones con campos faltantes sean rechazadas con HTTP 422."""
    payload_invalido = {
        "correo": "correo-no-valido",
    }
    response = client.post("/api/v1/auth/login", json=payload_invalido)
    assert response.status_code == 422


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="Defecto D-3 / TC-30: Backend stub acepta cualquier password; pendiente implementación por Marcos",
)
def test_login_password_incorrecto_rechazado(client: TestClient):
    """TC-30: Verifica que credenciales erróneas sean rechazadas con HTTP 401."""
    payload = {
        "correo": "inspector@alervi.test",
        "password": "PasswordTotalmenteErroneo123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code in (401, 403)


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="Defecto D-1 / TC-31: Endpoints protegidos aún no tienen middleware de autenticación inyectado; pendiente implementación por Marcos",
)
def test_tc31_rutas_protegidas_sin_token_rechazan_401_o_403(client: TestClient):
    """TC-31: Sesión ausente en endpoints protegidos debe responder con HTTP 401 o 403."""
    endpoints_protegidos = [
        ("GET", "/api/v1/usuarios"),
        ("GET", "/api/v1/auditoria"),
        ("POST", "/api/v1/inspections"),
    ]
    for metodo, ruta in endpoints_protegidos:
        if metodo == "GET":
            res = client.get(ruta)
        else:
            res = client.post(
                ruta,
                json={
                    "id_punto": 101,
                    "fecha_visita": "2026-11-02",
                    "notas": "Intento sin token",
                },
            )
        assert res.status_code in (
            401,
            403,
        ), f"Endpoint {metodo} {ruta} accesible sin token: devolvió {res.status_code}"
