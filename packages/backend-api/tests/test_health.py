"""
Pruebas para los endpoints de salud y bienvenida de ALERVI API con pytest.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    """Verifica que el endpoint de salud responde con HTTP 200 y status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "alervi-api"
    assert "version" in data


def test_root_endpoint():
    """Verifica que el endpoint raiz responde con el mensaje informativo."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data
