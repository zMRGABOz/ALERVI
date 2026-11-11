package cl.alervi.data.repository.mock

import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas del repositorio de alertas `mock` (RD-01): usa el MISMO caso de uso
 * RB-13/RB-14 que el respaldo del flavor `local`, sin red.
 */
class MockAlertasRepositoryTest {

    private fun repositorio(contenido: String = FIXTURE) =
        MockAlertasRepository(
            puntos = MockPuntosRepository(Json) { contenido },
            useCase = EvaluarProximidadUseCase(),
        )

    private fun telemetria(
        latitud: Double = -36.8283,
        velocidad: Double = 15.0,
        rumbo: Double = 0.0,
    ) = Telemetria(
        idSesion = "sesion-prueba",
        latitud = latitud,
        longitud = -73.0543,
        velocidadMps = velocidad,
        rumboGrados = rumbo,
        precisionM = 5.0,
        timestampMs = System.currentTimeMillis(),
    )

    @Test
    fun `aproximacion convergente emite alerta con el punto del fixture`() =
        runBlocking {
            val resultado =
                repositorio().evaluar(
                    telemetria = telemetria(),
                    puntosYaAdvertidos = emptySet(),
                    ahoraMs = System.currentTimeMillis(),
                )

            assertTrue(resultado is EvaluacionAlerta.ConAlerta)
            assertEquals(101, (resultado as EvaluacionAlerta.ConAlerta).alerta.idPunto)
        }

    @Test
    fun `fixture ilegible se evalua como sin puntos en rango, no como alerta`() =
        runBlocking {
            val resultado =
                repositorio(contenido = "{no-json}").evaluar(
                    telemetria = telemetria(),
                    puntosYaAdvertidos = emptySet(),
                    ahoraMs = System.currentTimeMillis(),
                )

            assertTrue(resultado is EvaluacionAlerta.Suprimida)
            assertEquals(
                MotivoSupresion.SIN_PUNTOS_EN_RANGO,
                (resultado as EvaluacionAlerta.Suprimida).motivo,
            )
        }

    private companion object {
        val FIXTURE =
            """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "id": 101,
                  "geometry": {"type": "Point", "coordinates": [-73.0543, -36.8271]},
                  "properties": {
                    "id_punto": 101,
                    "nombre_interseccion": "Av. Paicaví con Av. Los Carrera",
                    "comuna": "Concepción",
                    "nivel_riesgo": "ALTO",
                    "indice_prioridad": 78.5,
                    "total_siniestros": 24
                  }
                }
              ]
            }
            """.trimIndent()
    }
}
