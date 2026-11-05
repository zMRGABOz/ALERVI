package cl.alervi.data.repository.mock

import cl.alervi.domain.model.OrigenDetalle
import java.io.File
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas del repositorio del flavor `mock` (RD-01):
 * fixtures locales que deben cumplir openapi.yaml y pasar por el mismo
 * pipeline de mapeo que el camino remoto.
 *
 * Vive en `src/testMock` porque referencia clases del source set `mock`.
 */
class MockPuntosRepositoryTest {

    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    private fun repositorio(): MockPuntosRepository {
        val ruta =
            sequenceOf(
                File("src/mock/assets/fixtures/puntos_criticos_publicos.json"),
                File("app/src/mock/assets/fixtures/puntos_criticos_publicos.json"),
            ).first { it.exists() }
        return MockPuntosRepository(json, { ruta.readText() })
    }

    @Test
    fun `el fixture carga como GeoJSON valido con 8 puntos de Concepcion`() =
        runTest {
            val puntos = repositorio().obtenerPuntos().getOrThrow()
            assertEquals(8, puntos.size)
            assertTrue(puntos.all { it.comuna == "Concepción" }) // RB-1
            assertTrue(puntos.all { it.latitud < 0 && it.longitud < 0 }) // WGS 84 sur/oeste
        }

    @Test
    fun `el fixture cumple estrictamente el contrato (sin campos desconocidos)`() {
        // Json ESTRICTO: fallaría ante cualquier clave fuera de openapi.yaml.
        val jsonEstricto = Json { ignoreUnknownKeys = false }
        val ruta =
            sequenceOf(
                File("src/mock/assets/fixtures/puntos_criticos_publicos.json"),
                File("app/src/mock/assets/fixtures/puntos_criticos_publicos.json"),
            ).first { it.exists() }
        val fc = jsonEstricto.decodeFromString<cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto>(ruta.readText())
        assertEquals("FeatureCollection", fc.type)
        assertEquals(8, fc.features.size)
    }

    @Test
    fun `filtro por comuna inexistente da lista vacia (TC-06)`() =
        runTest {
            val puntos = repositorio().obtenerPuntos(comuna = "Chiguayante").getOrThrow()
            assertTrue(puntos.isEmpty())
        }

    @Test
    fun `el detalle simulado trae la advertencia legal RB-6`() =
        runTest {
            val detalle = repositorio().obtenerDetalle(101).getOrThrow()
            assertEquals(OrigenDetalle.SIMULADO, detalle.origen)
            assertTrue(detalle.advertenciaLegal.contains("prioridad"))
        }

    @Test
    fun `detalle de punto inexistente en fixtures falla sin inventar`() =
        runTest {
            val r = repositorio().obtenerDetalle(999)
            assertTrue(r.isFailure)
        }
}
