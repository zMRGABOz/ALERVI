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
def test_login_password_incorrecto_rechazado(client: TestClient):
    """TC-30: Verifica que credenciales erróneas sean rechazadas con HTTP 401."""
    payload = {
        "correo": "inspector@alervi.test",
        "password": "PasswordTotalmenteErroneo123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code in (401, 403)


@pytest.mark.integration
def test_tc31_rutas_protegidas_sin_token_rechazan_401_o_403(client: TestClient):
    """TC-31: Sesión ausente en endpoints protegidos debe responder con HTTP 401 o 403."""
    endpoints_protegidos = [
        ("GET", "/api/v1/usuarios", None),
        ("GET", "/api/v1/auditoria", None),
        (
            "POST",
            "/api/v1/inspections",
            {
                "id_punto": 101,
                "fecha_visita": "2026-11-02",
                "notas": "Intento sin token",
            },
        ),
        (
            "POST",
            "/api/v1/cargas",
            {
                "fuente": "CONASET_ARCGIS",
                "anio": 2024,
                "descripcion": "Intento sin token",
                "registros": [],
            },
        ),
        (
            "PUT",
            "/api/v1/ponderaciones",
            {
                "w_severidad": 0.4,
                "w_frecuencia": 0.2,
                "w_tendencia": 0.2,
                "w_contexto": 0.2,
            },
        ),
        (
            "PUT",
            "/api/v1/factores/ponderaciones",
            {
                "w_severidad": 0.4,
                "w_frecuencia": 0.2,
                "w_tendencia": 0.2,
                "w_contexto": 0.2,
            },
        ),
        (
            "POST",
            "/api/v1/factores",
            {"nombre": "Factor sin token", "descripcion": "desc"},
        ),
        (
            "POST",
            "/api/v1/factores-riesgo",
            {"nombre": "Factor sin token", "descripcion": "desc"},
        ),
        ("PATCH", "/api/v1/factores/1", {"activo": False}),
        ("PATCH", "/api/v1/factores-riesgo/1", {"activo": False}),
        ("GET", "/api/v1/inspections/1", None),
        ("GET", "/api/v1/puntos/101/fichas", None),
        ("GET", "/api/v1/puntos/101/inspections", None),
    ]
    for metodo, ruta, payload in endpoints_protegidos:
        if metodo == "GET":
            res = client.get(ruta)
        elif metodo == "POST":
            res = client.post(ruta, json=payload or {})
        elif metodo == "PUT":
            res = client.put(ruta, json=payload or {})
        elif metodo == "PATCH":
            res = client.patch(ruta, json=payload or {})
        else:
            res = client.request(metodo, ruta)
        assert res.status_code in (
            401,
            403,
        ), f"Endpoint {metodo} {ruta} accesible sin token: devolvió {res.status_code}"


@pytest.mark.integration
def test_jwt_bypass_tokens_rechazados(client: TestClient):
    """Verifica que tokens sintéticos de desarrollo (jwt.valid, jwt.stub) sean rechazados con HTTP 401."""
    tokens_invalidos = [
        "jwt.valid",
        "jwt.1.valid",
        "jwt.2.valid",
        "jwt.stub",
        "Bearer jwt.valid",
        "invalid.token.structure",
    ]
    for token in tokens_invalidos:
        auth_header = {
            "Authorization": f"Bearer {token}"
            if not token.startswith("Bearer ")
            else token
        }
        res = client.get("/api/v1/usuarios", headers=auth_header)
        assert res.status_code == 401, (
            f"Token bypass no fue rechazado: {token} devolvió {res.status_code}"
        )


@pytest.mark.integration
def test_rb11_inspector_no_puede_editar_ficha_ajena(client: TestClient):
    """RB-11: Verifica que un inspector autenticado no pueda editar la ficha de otro inspector (HTTP 403)."""
    from app.core.security import create_access_token

    # Token para un inspector ajeno (id_usuario = 99)
    otro_inspector_token = create_access_token(
        {
            "sub": "99",
            "id_usuario": 99,
            "correo": "otro_inspector@alervi.test",
            "rol": "inspector",
        }
    )
    headers = {"Authorization": f"Bearer {otro_inspector_token}"}

    # Intentar editar ficha 101 (cuya autoría en mock/BD pertenece al inspector 2)
    response = client.patch(
        "/api/v1/inspections/1",
        json={"notas": "Intento de edición no autorizada por otro inspector"},
        headers=headers,
    )
    assert response.status_code == 403
    assert "RB-11" in response.json()["detail"] or "autor" in response.json()["detail"]


@pytest.mark.unit
def test_security_argon2id_hashing_and_verification():
    """RNF-S-1: Verifica hashing con Argon2id y rechazo de contraseñas en texto plano."""
    from app.core.security import get_password_hash, verify_password

    # Generación con Argon2id
    pwd = "ContrasenaSegura2026*"
    hashed = get_password_hash(pwd)
    assert hashed.startswith("$argon2id$")

    # Verificación exitosa
    assert verify_password(pwd, hashed) is True

    # Verificación errónea
    assert verify_password("ContrasenaIncorrecta", hashed) is False

    # Verificación con contraseña vacía o hash nulo
    assert verify_password("", hashed) is False
    assert verify_password(pwd, "") is False

    # Texto plano directo no debe ser aceptado como hash
    assert verify_password(pwd, pwd) is False
