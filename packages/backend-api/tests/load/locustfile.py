"""
Locust Load Testing Suite for ALERVI Backend API
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Simula tráfico concurrente sobre:
1. DSS Municipal: /ranking (on-the-fly scoring de >2000 puntos críticos).
2. Móvil Ciudadano: /alerts (evaluación cinemática en tiempo real con PostGIS).

Criterio de Aceptación SRS:
- Throughput: >= 50 req/s
- Latencia: Percentil 95 (p95) <= 800 ms
- Tasa de errores: 0%
"""

import random
import time
import uuid

from locust import HttpUser, between, task

# Coordenadas realistas de prueba en el Gran Concepción / San Pedro de la Paz
POSICIONES_CONCEPCION = [
    # Paicaví con Los Carrera
    {"lat": -36.8285, "lon": -73.0550, "speed": 12.5, "heading": 45.0},
    # Rotonda General Bonilla
    {"lat": -36.8041, "lon": -73.0319, "speed": 15.0, "heading": 90.0},
    # Av. Prat con San Martín
    {"lat": -36.8312, "lon": -73.0610, "speed": 11.1, "heading": 180.0},
    # Los Carrera con Orompello
    {"lat": -36.8242, "lon": -73.0489, "speed": 13.8, "heading": 60.0},
    # Av. Chacabuco con Tucapel
    {"lat": -36.8290, "lon": -73.0421, "speed": 10.0, "heading": 270.0},
]


class AlerviUser(HttpUser):
    """
    Usuario simulado con comportamiento balanceado entre:
    - Consultas DSS de Ranking (cálculo multicriterio on-the-fly)
    - Telemetría vehicular ciudadana (evaluación PostGIS de proximidad)
    """

    # Pausa mínima entre peticiones por usuario para modelar alta concurrencia
    wait_time = between(0.01, 0.05)

    def on_start(self):
        self.session_id = str(uuid.uuid4())

    @task(3)
    def test_ranking_on_the_fly(self):
        """
        Consulta el ranking comunal de Concepción.
        Dispara el cálculo dinámico en tiempo real de los más de 2000 puntos (2672 en Supabase).
        """
        path = random.choice(["/ranking", "/api/v1/ranking"])
        params = {
            "comuna": "Concepción",
            "periodo_inicio": 2020,
            "periodo_fin": 2025,
            "limit": 10,
        }
        with self.client.get(
            path,
            params=params,
            name="/ranking [calculo on-the-fly >2000 puntos]",
            catch_response=True,
            timeout=5.0,
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    total = data.get("total_puntos", 0)
                    if total >= 2000:
                        response.success()
                    else:
                        response.failure(f"Puntos insuficientes: {total} < 2000")
                except Exception as e:
                    response.failure(f"Respuesta JSON inválida: {e}")
            else:
                response.failure(f"HTTP {response.status_code}: {response.text}")

    @task(3)
    def test_alerts_evaluacion_cinematica(self):
        """
        Envía telemetría de navegación instantánea para evaluar cercanía a puntos críticos.
        """
        path = random.choice(["/alerts", "/api/v1/alerts"])
        coord = random.choice(POSICIONES_CONCEPCION)
        payload = {
            "session_id": self.session_id,
            "latitude": coord["lat"] + random.uniform(-0.0005, 0.0005),
            "longitude": coord["lon"] + random.uniform(-0.0005, 0.0005),
            "speed_mps": coord["speed"],
            "heading_degrees": coord["heading"],
            "accuracy_m": 5.0,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with self.client.post(
            path,
            json=payload,
            name="/alerts [evaluacion PostGIS cinematica]",
            catch_response=True,
            timeout=5.0,
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "telemetria_status" in data:
                        response.success()
                    else:
                        response.failure("Falta campo 'telemetria_status'")
                except Exception as e:
                    response.failure(f"Respuesta JSON inválida: {e}")
            else:
                response.failure(f"HTTP {response.status_code}: {response.text}")
