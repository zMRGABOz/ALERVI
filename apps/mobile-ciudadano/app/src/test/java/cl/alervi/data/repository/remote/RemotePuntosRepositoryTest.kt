package cl.alervi.data.repository.remote

import cl.alervi.data.api.PublicoApi
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.domain.model.OrigenDetalle
import java.nio.file.Files
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Pruebas del repositorio remoto de puntos (RF-2, TC-06/TC-07):
 * distinción entre lista vacía y error de red, caché R-8 y respaldo del
 * detalle ante 404 (endpoint de detalle aún ausente en `develop`).
 */
class RemotePuntosRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var cache: CachePuntosPublicos
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    private val geojsonUnPunto =
        """
        {"type":"FeatureCollection","features":[
          {"type":"Feature","id":101,
           "geometry":{"type":"Point","coordinates":[-73.0543,-36.8271]},
           "properties":{"id_punto":101,"nombre_interseccion":"Av. Paicaví con Av. Los Carrera",
                          "comuna":"Concepción","nivel_riesgo":"ALTO","indice_prioridad":78.5,
                          "total_siniestros":24}}]}
        """.trimIndent()

    @Before
    fun preparar() {
        server = MockWebServer()
        server.start()
        cache = CachePuntosPublicos(json, Files.createTempDirectory("cache-alervi").toFile())
    }

    @After
    fun limpiar() {
        server.shutdown()
    }

    private fun repo(): RemotePuntosRepository {
        val retrofit =
            Retrofit
                .Builder()
                .baseUrl(server.url("/"))
                .client(OkHttpClient())
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
        return RemotePuntosRepository(retrofit.create(PublicoApi::class.java), cache)
    }

    @Test
    fun `lista exitosa alimenta la cache y devuelve los puntos`() =
        runTest {
            server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(geojsonUnPunto))
            val r = repo().obtenerPuntos()
            assertTrue(r.isSuccess)
            assertEquals(1, r.getOrThrow().size)
            assertEquals(101, cache.cargar().first().idPunto) // caché R-8 actualizada
            assertEquals("/api/v1/publico/riesgo", server.takeRequest().path)
        }

    @Test
    fun `TC-06 coleccion sin features es exito con lista vacia (no error)`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setHeader("Content-Type", "application/json")
                    .setBody("""{"type":"FeatureCollection","features":[]}"""),
            )
            val r = repo().obtenerPuntos()
            assertTrue(r.isSuccess)
            assertTrue(r.getOrThrow().isEmpty())
        }

    @Test
    fun `TC-07 falla de red devuelve failure (distinguible de lista vacia)`() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(500).setBody("error interno"))
            val r = repo().obtenerPuntos()
            assertTrue(r.isFailure)
        }

    @Test
    fun `detalle 404 usa el respaldo desde la lista y marca RESPALDO_LISTA`() =
        runTest {
            // Primero la lista (alimenta la caché), luego el 404 del detalle.
            server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(geojsonUnPunto))
            server.enqueue(
                MockResponse()
                    .setResponseCode(404)
                    .setHeader("Content-Type", "application/json")
                    .setBody("""{"codigo":"PUNTO_NO_ENCONTRADO","mensaje":"El punto crítico con ID 42 no existe en el sistema."}"""),
            )
            val repositorio = repo()
            repositorio.obtenerPuntos() // caché lista
            val detalle = repositorio.obtenerDetalle(101)
            assertTrue(detalle.isSuccess)
            assertEquals(OrigenDetalle.RESPALDO_LISTA, detalle.getOrThrow().origen)
            assertEquals(101, detalle.getOrThrow().idPunto)
        }

    @Test
    fun `detalle 404 sin cache disponible falla (no se inventa el punto)`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(404)
                    .setHeader("Content-Type", "application/json")
                    .setBody("""{"codigo":"PUNTO_NO_ENCONTRADO","mensaje":"no existe"}"""),
            )
            val r = repo().obtenerDetalle(999)
            assertTrue(r.isFailure)
        }
}
