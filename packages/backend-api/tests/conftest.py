"""
Configuración global de fixtures y mocks para la suite de pruebas de ALERVI Backend.
-------------------------------------------------------------------------------------
Define fixtures reutilizables para TestClient, sesiones de prueba y payloads mock.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Fixture que provee un TestClient para peticiones HTTP a la aplicación FastAPI."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def db_session_mock():
    """Fixture para simular/mockear sesiones de SQLAlchemy en tests unitarios e integrados."""
    # Para tests aislados donde se requiera interceptar queries o writes a la BD
    yield None


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    """Fixture que autentica al usuario inspector de prueba y retorna los headers con Bearer JWT."""
    payload = {
        "correo": "inspector@alervi.test",
        "password": "Dev-2026-ALERVI",
        "codigo_mfa": "482910",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    if response.status_code == 200:
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    return {}


@pytest.fixture
def sample_telemetry_payload() -> dict:
    """Payload de telemetría vehicular sintética para evaluación cinemática en /alerts."""
    return {
        "session_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "latitude": -36.8285,
        "longitude": -73.0550,
        "speed_mps": 13.88,
        "heading_degrees": 45.0,
        "accuracy_m": 8.5,
        "timestamp": "2026-11-03T02:30:00Z",
    }
