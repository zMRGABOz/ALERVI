package cl.alervi.data.local

import cl.alervi.data.api.dto.GeoJsonFeatureDto
import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.api.dto.GeoJsonPointDto
import cl.alervi.data.api.dto.PuntoCriticoPropertiesDto
import java.nio.file.Files
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas de la caché local de puntos públicos (R-8, E1 §12).
 * Verifica el ciclo guardar/cargar (memoria y archivo) con datos PÚBLICOS.
 */
class CachePuntosPublicosTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun fc() =
        GeoJsonFeatureCollectionDto(
            type = "FeatureCollection",
            features =
                listOf(
                    GeoJsonFeatureDto(
                        type = "Feature",
                        id = 101,
                        geometry = GeoJsonPointDto(type = "Point", coordinates = listOf(-73.0543, -36.8271)),
                        properties =
                            PuntoCriticoPropertiesDto(
                                idPunto = 101,
                                nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
                                comuna = "Concepción",
                                nivelRiesgo = "ALTO",
                                indicePrioridad = 78.5,
                                totalSiniestros = 24,
                            ),
                    ),
                ),
        )

    @Test
    fun `guardar y cargar mantiene los puntos (memoria y archivo)`() = runTest {
        val dir = Files.createTempDirectory("cache-alervi").toFile()
        val cache = CachePuntosPublicos(json, dir)
        assertTrue(cache.cargar().isEmpty()) // sin datos previos

        cache.guardar(fc())
        assertEquals(1, cache.cargar().size)
        assertEquals(101, cache.cargar().first().idPunto)
    }

    @Test
    fun `la cache sobrevive a una nueva instancia (archivo persistido)`() = runTest {
        val dir = Files.createTempDirectory("cache-alervi").toFile()
        val primera = CachePuntosPublicos(json, dir)
        primera.guardar(fc())

        // Nueva instancia (p. ej., reinicio del proceso): lee del archivo.
        val segunda = CachePuntosPublicos(json, dir)
        val puntos = segunda.cargar()
        assertEquals(1, puntos.size)
        assertEquals("Av. Paicaví con Av. Los Carrera", puntos.first().nombreInterseccion)
    }

    @Test
    fun `archivo corrupto o ausente devuelve lista vacia sin lanzar error`() = runTest {
        val dir = Files.createTempDirectory("cache-alervi").toFile()
        val cache = CachePuntosPublicos(json, dir)
        assertTrue(cache.cargar().isEmpty())

        java.io.File(dir, "cache_puntos_publicos.json").writeText("{ no es json valido")
        assertTrue(cache.cargar().isEmpty())
    }
}
