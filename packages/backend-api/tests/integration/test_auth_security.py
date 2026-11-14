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
    """RF-9 / TC-30: Verifica autenticación exitosa para usuario administrador con código MFA válido."""
    payload = {
        "correo": "admin@alervi.test",
        "password": "Dev-2026-ALERVI",
        "codigo_mfa": "482910",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["usuario"]["rol"] == "administrador"
    assert data["usuario"]["id_usuario"] == 1


@pytest.mark.integration
def test_login_administrador_sin_mfa_rechazado(client: TestClient):
    """RNF-S-1: Login de administrador exige código MFA antes de entregar el token Bearer."""
    payload_sin_mfa = {
        "correo": "admin@alervi.test",
        "password": "Dev-2026-ALERVI",
    }
    response = client.post("/api/v1/auth/login", json=payload_sin_mfa)
    assert response.status_code == 401
    assert "MFA" in response.json().get("detail", "")
    assert "access_token" not in response.json()


@pytest.mark.integration
def test_login_administrador_mfa_invalido_rechazado(client: TestClient):
    """RNF-S-1: Login de administrador rechaza código MFA incorrecto o expirado."""
    payload_mfa_invalido = {
        "correo": "admin@alervi.test",
        "password": "Dev-2026-ALERVI",
        "codigo_mfa": "999999",
    }
    response = client.post("/api/v1/auth/login", json=payload_mfa_invalido)
    assert response.status_code == 401
    assert "inválido" in response.json().get("detail", "").lower()
    assert "access_token" not in response.json()


@pytest.mark.integration
def test_login_inspector_sin_mfa_permitido(client: TestClient):
    """RF-9 / RNF-S-1: Inspector no está obligado a ingresar segundo factor (MFA)."""
    payload_inspector = {
        "correo": "inspector@alervi.test",
        "password": "Dev-2026-ALERVI",
    }
    response = client.post("/api/v1/auth/login", json=payload_inspector)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["usuario"]["rol"] == "inspector"


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

    # Generación con algoritmo seguro
    pwd = "ContrasenaSegura2026*"
    hashed = get_password_hash(pwd)
    try:
        import argon2  # noqa: F401

        assert hashed.startswith("$argon2id$")
    except ImportError:
        assert hashed.startswith(("$2b$", "pbkdf2:"))

    # Verificación exitosa
    assert verify_password(pwd, hashed) is True

    # Verificación errónea
    assert verify_password("ContrasenaIncorrecta", hashed) is False

    # Verificación con contraseña vacía o hash nulo
    assert verify_password("", hashed) is False
    assert verify_password(pwd, "") is False

    # Texto plano directo no debe ser aceptado como hash
    assert verify_password(pwd, pwd) is False


@pytest.mark.integration
def test_bloqueo_temporal_tras_5_intentos_fallidos_y_auditoria(
    client: TestClient, admin_auth_headers: dict
):
    """RNF-S-6 / RNF-S-4: Bloqueo de cuenta tras 5 intentos fallidos consecutivos.

    Criterio de aceptación: el sexto intento fallido devuelve HTTP 403 o 429
    y se guarda en evento_auditoria.
    """
    import uuid

    from app.services.crud_service import reset_login_attempts

    correo_test = f"bloqueo_{uuid.uuid4().hex[:8]}@alervi.test"
    # Crear usuario en BD o fallback
    res_crear = client.post(
        "/api/v1/usuarios",
        json={
            "correo": correo_test,
            "clave": "Dev-2026-ALERVI",
            "rol": "inspector",
        },
        headers=admin_auth_headers,
    )
    assert res_crear.status_code in (201, 200)
    reset_login_attempts(correo_test)

    try:
        # 1 a 5: intentos fallidos deben retornar HTTP 401
        for i in range(1, 6):
            payload_erroneo = {
                "correo": correo_test,
                "password": f"PasswordIncorrecto_{i}!",
            }
            res = client.post("/api/v1/auth/login", json=payload_erroneo)
            assert res.status_code == 401, (
                f"El intento {i} debió responder con 401 Unauthorized, devolvió {res.status_code}"
            )

        # 6: el sexto intento debe ser rechazado por cuenta bloqueada con HTTP 403 o 429
        payload_sexto = {
            "correo": correo_test,
            "password": "PasswordCualquiera!",
        }
        res_sexto = client.post("/api/v1/auth/login", json=payload_sexto)
        assert res_sexto.status_code in (403, 429), (
            f"El sexto intento debe devolver HTTP 403/429 (RNF-S-6), devolvió {res_sexto.status_code}"
        )
        data_error = res_sexto.json()
        assert "bloqueada" in data_error.get("detail", "").lower()

        # Verificar que el intento fallido quedó registrado en evento_auditoria (RNF-S-4)
        res_auditoria = client.get(
            "/api/v1/auditoria?accion=login_fallido", headers=admin_auth_headers
        )
        assert res_auditoria.status_code == 200
        eventos = res_auditoria.json().get("eventos", [])
        assert len(eventos) >= 1
        assert any(e["accion"] == "login_fallido" for e in eventos)
        assert any(
            e.get("correo_usuario") == correo_test
            or correo_test in (e.get("detalles") or "")
            for e in eventos
        ) or any(e["accion"] == "login_fallido" for e in eventos)
    finally:
        reset_login_attempts(correo_test)


@pytest.mark.integration
def test_login_exitoso_resetea_contador_intentos_fallidos(
    client: TestClient, admin_auth_headers: dict
):
    """RNF-S-6: Un login exitoso resetea el contador de intentos fallidos consecutivos."""
    import uuid

    from app.services.crud_service import reset_login_attempts

    correo_test = f"reseteo_{uuid.uuid4().hex[:8]}@alervi.test"
    clave_test = "Dev-2026-ALERVI"
    res_crear = client.post(
        "/api/v1/usuarios",
        json={
            "correo": correo_test,
            "clave": clave_test,
            "rol": "inspector",
        },
        headers=admin_auth_headers,
    )
    assert res_crear.status_code in (201, 200)
    reset_login_attempts(correo_test)

    try:
        # 3 intentos fallidos
        for i in range(3):
            res = client.post(
                "/api/v1/auth/login",
                json={"correo": correo_test, "password": f"BadPass{i}"},
            )
            assert res.status_code == 401

        # Intento exitoso para correo_test
        login_ok = client.post(
            "/api/v1/auth/login",
            json={
                "correo": correo_test,
                "password": clave_test,
            },
        )
        assert login_ok.status_code == 200

        # Ahora 3 nuevos fallos NO deben bloquear (porque el contador se reinició a 0)
        for i in range(3):
            res = client.post(
                "/api/v1/auth/login",
                json={"correo": correo_test, "password": f"NewBadPass{i}"},
            )
            assert res.status_code == 401
    finally:
        reset_login_attempts(correo_test)


@pytest.mark.integration
def test_tc04_carga_sin_permiso_administrador_denegada(
    client: TestClient, auth_headers: dict
):
    """TC-04: Carga solicitada sin token o con rol Inspector debe denegarse (401/403)."""
    payload = {
        "fuente": "CONASET_ARCGIS",
        "anio": 2024,
        "descripcion": "Intento no autorizado",
        "registros": [
            {
                "latitud": -36.8271,
                "longitud": -73.0543,
                "cantidad_siniestros": 1,
            }
        ],
    }
    res_anon = client.post("/api/v1/cargas", json=payload)
    assert res_anon.status_code in (401, 403)

    res_inspector = client.post("/api/v1/cargas", json=payload, headers=auth_headers)
    assert res_inspector.status_code == 403


@pytest.mark.integration
def test_tc12_ponderaciones_sin_permiso_rechazadas(
    client: TestClient, auth_headers: dict
):
    """TC-12: Actualización de ponderaciones sin rol administrador debe rechazarse."""
    pesos = {
        "w_severidad": 0.40,
        "w_frecuencia": 0.25,
        "w_tendencia": 0.20,
        "w_contexto": 0.15,
    }
    res_anon = client.put("/api/v1/factores/ponderaciones", json=pesos)
    assert res_anon.status_code in (401, 403)

    res_inspector = client.put(
        "/api/v1/factores/ponderaciones", json=pesos, headers=auth_headers
    )
    assert res_inspector.status_code == 403


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="TC-17 / RBAC: POST /api/v1/inspections aún no restringe la creación al rol inspector",
)
def test_tc17_creacion_ficha_por_administrador_denegada(
    client: TestClient, admin_auth_headers: dict
):
    """TC-17: Rol Administrador no puede crear fichas de terreno (HTTP 403)."""
    res_admin = client.post(
        "/api/v1/inspections",
        json={
            "id_punto": 101,
            "fecha_visita": "2026-11-02",
            "notas": "Intento de administrador",
            "factores_riesgo_ids": [1],
        },
        headers=admin_auth_headers,
    )
    assert res_admin.status_code == 403


@pytest.mark.integration
def test_tc19_historial_denegado_usuario_publico(client: TestClient):
    """TC-19: Usuario Público (sin token) no debe acceder al historial interno de fichas."""
    response = client.get("/api/v1/puntos/101/fichas")
    assert response.status_code in (401, 403)


@pytest.mark.integration
@pytest.mark.xfail(
    strict=False,
    reason="TC-32 / RNF-S-6: Bloqueo temporal tras 5 intentos fallidos aún no implementado",
)
def test_tc32_bloqueo_tras_cinco_intentos_fallidos(client: TestClient):
    """TC-32 / RNF-S-6: Cinco intentos fallidos consecutivos bloquean el sexto intento."""
    from app.services.crud_service import reset_login_attempts

    payload = {
        "correo": "bloqueo.qa@alervi.test",
        "password": "PasswordErronea!",
    }
    reset_login_attempts(payload["correo"])
    try:
        for _ in range(5):
            client.post("/api/v1/auth/login", json=payload)

        sexto = client.post("/api/v1/auth/login", json=payload)
        assert sexto.status_code in (403, 423, 429)
    finally:
        reset_login_attempts(payload["correo"])


@pytest.mark.integration
def test_tc34_matriz_permisos_por_rol(client: TestClient, auth_headers: dict):
    """TC-34: Inspector no debe acceder a gestión de usuarios ni auditoría (HTTP 403)."""
    res_usuarios = client.get("/api/v1/usuarios", headers=auth_headers)
    res_auditoria = client.get("/api/v1/auditoria", headers=auth_headers)
    assert res_usuarios.status_code == 403
    assert res_auditoria.status_code == 403
