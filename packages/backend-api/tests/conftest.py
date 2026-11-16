"""PostGIS real, datos sintéticos y transacciones aisladas para la suite del backend."""

import io
import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.main import app
from app.services import crud_service


@pytest.fixture(scope="session")
def test_engine():
    """Aplica las migraciones de tablas en un esquema nuevo, usando una URL explícita."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        raise pytest.UsageError(
            "Define TEST_DATABASE_URL con una base PostgreSQL/PostGIS de pruebas."
        )
    schema = f"pytest_{uuid.uuid4().hex}"
    engine = create_engine(
        url, connect_args={"options": f"-csearch_path={schema},public"}
    )
    migrations = Path(__file__).resolve().parents[2] / "db" / "migrations"
    try:
        with engine.connect().execution_options(
            isolation_level="AUTOCOMMIT"
        ) as connection:
            connection.exec_driver_sql(
                "CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public"
            )
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            for filename in (
                "001_datos_geoespaciales.sql",
                "002_usuario_inspeccion_auditoria.sql",
            ):
                connection.exec_driver_sql((migrations / filename).read_text())
            connection.exec_driver_sql(
                Path(__file__).with_name("fixtures.sql").read_text(),
                {"password_hash": get_password_hash("Dev-2026-ALERVI")},
            )
        yield engine
    finally:
        with engine.connect().execution_options(
            isolation_level="AUTOCOMMIT"
        ) as connection:
            connection.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """Los commits del servicio usan savepoints; cada prueba revierte su transacción."""
    with test_engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture(autouse=True)
def isolated_backend(db_session, monkeypatch, tmp_path):
    """Aísla sesiones, bloqueo, ponderaciones y archivos entre pruebas."""

    def override_db():
        yield db_session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_db)
    monkeypatch.setattr(settings, "backend_secret_key", "test-secret")
    monkeypatch.setattr(settings, "backend_debug", True)
    monkeypatch.setattr(settings, "admin_mfa_default_code", "482910")
    monkeypatch.setattr(settings, "admin_totp_secret", "")
    monkeypatch.setattr(settings, "photo_storage_backend", "local")
    monkeypatch.setattr(settings, "photo_storage_directory", str(tmp_path / "fichas"))
    monkeypatch.setattr(settings, "photo_storage_public_base_url", "http://testserver")
    monkeypatch.setattr(settings, "supabase_url", "https://storage.alervi.test")
    monkeypatch.setattr(settings, "supabase_key", "")
    monkeypatch.setattr(settings, "supabase_storage_bucket", "fichas")
    monkeypatch.setattr(
        crud_service,
        "_PONDERACIONES_VIGENTES",
        crud_service._PONDERACIONES_VIGENTES.copy(),
    )
    crud_service.reset_login_attempts()
    yield
    crud_service.reset_login_attempts()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _login_headers(client, correo):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "correo": correo,
            "password": "Dev-2026-ALERVI",
            "codigo_mfa": "482910",
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    return _login_headers(client, "inspector@alervi.test")


@pytest.fixture
def admin_auth_headers(client: TestClient) -> dict:
    return _login_headers(client, "admin@alervi.test")


@pytest.fixture
def other_auth_headers(client: TestClient) -> dict:
    return _login_headers(client, "otro_inspector@alervi.test")


@pytest.fixture
def inspector_user():
    return {"id_usuario": 2, "correo": "inspector@alervi.test", "rol": "inspector"}


@pytest.fixture
def jpeg_photo():
    image = Image.new("RGB", (24, 24), color="red")
    output = io.BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def sample_telemetry_payload() -> dict:
    """Payload de telemetría vehicular sintética para evaluación cinemática en /alerts."""
    return {
        "session_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "latitude": -36.8281,
        "longitude": -73.0543,
        "speed_mps": 13.88,
        "heading_degrees": 0.0,
        "accuracy_m": 8.5,
        "timestamp": "2026-11-03T02:30:00Z",
    }
