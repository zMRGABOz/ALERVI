package cl.alervi.data.repository.mock

import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.OrigenDetalle
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas del repositorio `mock` (RD-01): fixtures locales, filtro por comuna
 * y respaldo de detalle con el mismo pipeline de contrato que el camino remoto.
 */
class MockPuntosRepositoryTest {

    private val json = Json { ignoreUnknownKeys = true }

    private var lecturas = 0

    private fun repositorio(
        contenido: String = FIXTURE,
    ): MockPuntosRepository =
        MockPuntosRepository(json) {
            lecturas++
            contenido
        }

    @Test
    fun `sin filtro devuelve todos los puntos del fixture`() =
        runBlocking {
            val puntos = repositorio().obtenerPuntos(comuna = null).getOrThrow()

            assertEquals(listOf(101, 102), puntos.map { it.idPunto })
            assertEquals(NivelRiesgo.ALTO, puntos.first().nivelRiesgo)
        }

    @Test
    fun `filtra por comuna sin distinguir mayusculas`() =
        runBlocking {
            val repo = repositorio()
            val concepcion = repo.obtenerPuntos(comuna = "concepción").getOrThrow()
            val talcahuano = repo.obtenerPuntos(comuna = "TALCAHUANO").getOrThrow()

            assertEquals(listOf(101), concepcion.map { it.idPunto })
            assertEquals(listOf(102), talcahuano.map { it.idPunto })
        }

    @Test
    fun `el fixture se lee una sola vez y se conserva en memoria`() =
        runBlocking {
            val repo = repositorio()
            repo.obtenerPuntos(comuna = null).getOrThrow()
            repo.obtenerPuntos(comuna = "Concepción").getOrThrow()

            assertEquals(1, lecturas)
        }

    @Test
    fun `detalle existente usa respaldo de lista marcado como simulado`() =
        runBlocking {
            val detalle = repositorio().obtenerDetalle(101).getOrThrow()

            assertEquals(101, detalle.idPunto)
            assertEquals(OrigenDetalle.SIMULADO, detalle.origen)
            assertNotNull(detalle.advertenciaLegal)
        }

    @Test
    fun `detalle inexistente devuelve falla sin inventar datos`() =
        runBlocking {
            val resultado = repositorio().obtenerDetalle(999)

            assertTrue(resultado.isFailure)
            assertTrue(resultado.exceptionOrNull() is NoSuchElementException)
        }

    @Test
    fun `fixture invalido devuelve falla en vez de propagar la excepcion`() =
        runBlocking {
            val resultado = repositorio(contenido = "{no-json}").obtenerPuntos(comuna = null)

            assertTrue(resultado.isFailure)
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
                },
                {
                  "type": "Feature",
                  "id": 102,
                  "geometry": {"type": "Point", "coordinates": [-73.05, -36.83]},
                  "properties": {
                    "id_punto": 102,
                    "nombre_interseccion": "Otra intersección",
                    "comuna": "Talcahuano",
                    "nivel_riesgo": "MEDIO",
                    "indice_prioridad": 50.0,
                    "total_siniestros": 5
                  }
                }
              ]
            }
            """.trimIndent()
    }
}
