"""
Suite completa de pruebas de integracion para ALERVI Backend API.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica el cumplimiento de todos los endpoints solicitados:
1. POST  /api/v1/auth/login
2. GET, POST, PATCH /api/v1/usuarios y /api/v1/usuarios/{id}
3. POST  /api/v1/cargas
4. GET   /api/v1/publico/riesgo
5. GET   /api/v1/ranking
6. GET   /api/v1/puntos/{id_punto}
7. GET, POST, PATCH /api/v1/factores y GET, PUT /api/v1/factores/ponderaciones
8. POST, GET, PATCH /api/v1/inspections y /api/v1/inspections/{id_ficha}
9. POST  /api/v1/inspections/{id_ficha}/fotos
10. GET  /api/v1/puntos/{id_punto}/fichas
11. POST /api/v1/alerts
12. GET  /api/v1/auditoria
13. CORS (http://localhost:3000) y mapeo de tablas en SQLAlchemy
"""

import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base
import app.models as models

client = TestClient(app)


class TestCompleteEndpointsAPI(unittest.TestCase):
    def test_orm_models_tables_mapped(self):
        """Verifica que los modelos ORM de SQLAlchemy mapean las tablas del esquema SQL."""
        tables = set(Base.metadata.tables.keys())
        expected_tables = {
            "comuna",
            "punto_critico",
            "registro",
            "elemento_urbano",
            "usuario",
            "factor_riesgo",
            "ficha_inspeccion",
            "registra",
            "fotografia",
            "evento_auditoria",
        }
        for table in expected_tables:
            self.assertIn(table, tables, f"La tabla {table} debe estar mapeada en Base.metadata")

    def test_cors_header(self):
        """Verifica que el middleware CORS responde al origen http://localhost:3000."""
        response = client.options(
            "/api/v1/publico/riesgo",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:3000")

    def test_auth_login(self):
        """Verifica inicio de sesion (POST /api/v1/auth/login)."""
        payload = {
            "correo": "inspector@alervi.test",
            "password": "Dev-2026-ALERVI",
            "codigo_mfa": "482910",
        }
        response = client.post("/api/v1/auth/login", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["usuario"]["rol"], "inspector")

    def test_usuarios_crud(self):
        """Verifica gestion de usuarios (GET, POST, PATCH /api/v1/usuarios)."""
        # Listar
        res_list = client.get("/api/v1/usuarios")
        self.assertEqual(res_list.status_code, 200)
        self.assertGreaterEqual(res_list.json()["total"], 1)

        # Crear
        res_create = client.post(
            "/api/v1/usuarios",
            json={"correo": "nuevo@alervi.test", "clave": "PasswordSegura2026*", "rol": "inspector"},
        )
        self.assertEqual(res_create.status_code, 201)
        self.assertEqual(res_create.json()["correo"], "nuevo@alervi.test")

        # Detalle
        res_get = client.get("/api/v1/usuarios/2")
        self.assertEqual(res_get.status_code, 200)

        # Modificar
        res_patch = client.patch(
            "/api/v1/usuarios/2",
            json={"activo": False},
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertFalse(res_patch.json()["activo"])

    def test_cargas_batch(self):
        """Verifica ingesta batch de siniestros CONASET (POST /api/v1/cargas)."""
        payload = {
            "fuente": "CONASET_ARCGIS",
            "anio": 2024,
            "descripcion": "Lote pruebas",
            "registros": [
                {
                    "latitud": -36.8271,
                    "longitud": -73.0543,
                    "cantidad_siniestros": 10,
                }
            ],
        }
        response = client.post("/api/v1/cargas", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["anio"], 2024)
        self.assertIn("total_procesados", data)

    def test_publico_riesgo_geojson(self):
        """Verifica capa de riesgo GeoJSON (GET /api/v1/publico/riesgo)."""
        response = client.get("/api/v1/publico/riesgo?comuna=Concepción")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertGreater(len(data["features"]), 0)

    def test_ranking(self):
        """Verifica calculo de ranking multicriterio (GET /api/v1/ranking)."""
        response = client.get("/api/v1/ranking?comuna=Concepción&limit=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_puntos", data)
        self.assertIn("puntos", data)

    def test_detalle_punto_tecnico(self):
        """Verifica detalle tecnico de un punto critico (GET /api/v1/puntos/{id_punto})."""
        response = client.get("/api/v1/puntos/101")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id_punto"], 101)
        self.assertIn("historico_anual", data)

    def test_factores_y_ponderaciones(self):
        """Verifica catalogo de factores y ponderaciones (GET, POST, PATCH /api/v1/factores)."""
        # Listar factores
        res_list = client.get("/api/v1/factores")
        self.assertEqual(res_list.status_code, 200)
        self.assertGreaterEqual(len(res_list.json()), 1)

        # Crear factor
        res_create = client.post(
            "/api/v1/factores",
            json={"nombre": "Nuevo factor de prueba", "descripcion": "Descripcion corta"},
        )
        self.assertEqual(res_create.status_code, 201)

        # Modificar factor
        res_patch = client.patch(
            "/api/v1/factores/1",
            json={"activo": False},
        )
        self.assertEqual(res_patch.status_code, 200)

        # Consultar ponderaciones
        res_pond = client.get("/api/v1/factores/ponderaciones")
        self.assertEqual(res_pond.status_code, 200)
        self.assertEqual(res_pond.json()["suma_pesos"], 1.0)

        # Calibrar ponderaciones
        res_update_pond = client.put(
            "/api/v1/factores/ponderaciones",
            json={
                "w_severidad": 0.40,
                "w_frecuencia": 0.20,
                "w_tendencia": 0.20,
                "w_contexto": 0.20,
            },
        )
        self.assertEqual(res_update_pond.status_code, 200)
        self.assertEqual(res_update_pond.json()["w_severidad"], 0.40)

    def test_inspections_y_fotos(self):
        """Verifica registro, detalle, edicion y fotos de inspecciones."""
        # Crear ficha valida
        payload = {
            "id_punto": 101,
            "fecha_visita": "2026-11-02",
            "notas": "Inspección técnica en terreno.",
            "factores_riesgo_ids": [1],
        }
        res_create = client.post("/api/v1/inspections", json=payload)
        self.assertEqual(res_create.status_code, 201)
        id_ficha = res_create.json()["id_ficha"]

        # Validacion restriccion 500 caracteres
        res_invalid = client.post(
            "/api/v1/inspections",
            json={"id_punto": 101, "fecha_visita": "2026-11-02", "notas": "X" * 501},
        )
        self.assertEqual(res_invalid.status_code, 422)

        # Detalle ficha
        res_get = client.get(f"/api/v1/inspections/{id_ficha}")
        self.assertEqual(res_get.status_code, 200)

        # Editar ficha (PATCH)
        res_patch = client.patch(
            f"/api/v1/inspections/{id_ficha}",
            json={"notas": "Notas actualizadas del inspector."},
        )
        self.assertEqual(res_patch.status_code, 200)

        # Adjuntar foto (POST /inspections/{id}/fotos)
        res_foto = client.post(f"/api/v1/inspections/{id_ficha}/fotos")
        self.assertEqual(res_foto.status_code, 201)
        self.assertIn("ruta", res_foto.json())

        # Historial de fichas por punto (GET /puntos/{id}/fichas)
        res_historial = client.get("/api/v1/puntos/101/fichas")
        self.assertEqual(res_historial.status_code, 200)
        self.assertIsInstance(res_historial.json(), list)

    def test_alerts_evaluacion(self):
        """Verifica evaluacion cinematica (POST /api/v1/alerts)."""
        payload = {
            "session_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
            "latitude": -36.8285,
            "longitude": -73.0550,
            "speed_mps": 13.88,
            "heading_degrees": 45.0,
            "accuracy_m": 8.5,
            "timestamp": "2026-11-03T02:30:00Z",
        }
        response = client.post("/api/v1/alerts", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["alerta_activa"])
        self.assertEqual(data["telemetria_status"], "EVALUADO_CON_ALERTA")

    def test_auditoria(self):
        """Verifica consulta de bitacora inmutable (GET /api/v1/auditoria)."""
        response = client.get("/api/v1/auditoria")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total", data)
        self.assertIn("eventos", data)
        self.assertGreaterEqual(len(data["eventos"]), 1)


if __name__ == "__main__":
    unittest.main()
