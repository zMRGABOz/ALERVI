package cl.alervi.data.repository.remote

import cl.alervi.data.api.AlertasApi
import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.api.dto.GeoJsonFeatureDto
import cl.alervi.data.api.dto.GeoJsonPointDto
import cl.alervi.data.api.dto.PuntoCriticoPropertiesDto
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import java.nio.file.Files
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Pruebas del repositorio remoto de alertas (RF-8, R-8, RNF-S-8).
 *
 * R-8: si `POST /api/v1/alerts` no responde en 3 s, el cálculo se hace en el
 * cliente con la caché local de puntos públicos (resultado marcado).
 * RNF-S-8: verificación de que las coordenadas viajan en el BODY, no en la URL.
 */
class RemoteAlertasRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var cache: CachePuntosPublicos
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    private val ahora = 1_772_000_000_000L

    private fun telemetria() =
        Telemetria(
            idSesion = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
            latitud = -36.83,
            longitud = -73.05,
            velocidadMps = 13.889, // 50 km/h rumbo Este
            rumboGrados = 90.0,
            precisionM = 8.5,
            timestampMs = ahora - 1_000,
        )

    /** Punto a ~100 m al ESTE del usuario (TTC ≈ 7,2 s). */
    private fun fcConPuntoEste() =
        GeoJsonFeatureCollectionDto(
            type = "FeatureCollection",
            features =
                listOf(
                    GeoJsonFeatureDto(
                        type = "Feature",
                        id = 101,
                        geometry = GeoJsonPointDto("Point", listOf(-73.05 + 100.0 / 89_080.0, -36.83)),
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

    private fun retrofit(client: OkHttpClient): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(server.url("/"))
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    private fun cliente(timeoutSeg: Long = 3) =
        OkHttpClient
            .Builder()
            .connectTimeout(timeoutSeg, TimeUnit.SECONDS)
            .readTimeout(timeoutSeg, TimeUnit.SECONDS)
            .callTimeout(timeoutSeg, TimeUnit.SECONDS)
            .build()

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

    @Test
    fun `respuesta del backend dentro del timeout se usa tal cual (calculadaEnCliente=false)`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setHeader("Content-Type", "application/json")
                    .setBody(
                        """
                        {"alerta_activa": true, "telemetria_status": "EVALUADO_CON_ALERTA",
                         "alerta": {"id_punto": 101, "nombre_interseccion": "Av. Paicaví con Av. Los Carrera",
                                    "nivel_riesgo": "ALTO", "distancia_m": 112.5, "ttc_segundos": 8.1,
                                    "mensaje_visual": "⚠️ Zona de Riesgo a 110 m: Paicaví / Carrera",
                                    "patron_sonoro": "BEEP_PRECAUCION",
                                    "instruccion_seguridad": "Reduzca velocidad y preste atención al cruce"}}
                        """.trimIndent(),
                    ),
            )
            val repo = RemoteAlertasRepository(retrofit(cliente()).create(AlertasApi::class.java), cache, EvaluarProximidadUseCase())
            val r = repo.evaluar(telemetria(), emptySet(), ahora) as EvaluacionAlerta.ConAlerta
            assertEquals(101, r.alerta.idPunto)
            assertTrue(!r.calculadaEnCliente)

            // RNF-S-8: la posición va en el BODY JSON, jamás en la URL.
            val peticion = server.takeRequest()
            assertEquals("/api/v1/alerts", peticion.path)
            val cuerpo = peticion.body.readUtf8()
            assertTrue(cuerpo.contains("\"latitude\""))
            assertTrue(cuerpo.contains("\"longitude\""))
            assertTrue("la URL no debe llevar coordenadas", !peticion.path!!.contains("36.") && !peticion.path!!.contains("73."))
        }

    @Test
    fun `R-8 backend lento (mas de 3 s) activa el calculo local con la cache`() =
        runTest {
            cache.guardar(fcConPuntoEste()) // caché de puntos públicos (R-8)
            server.dispatcher =
                object : Dispatcher() {
                    override fun dispatch(request: RecordedRequest): MockResponse {
                        Thread.sleep(5_000) // excede los 3 s de R-8
                        return MockResponse().setHeader("Content-Type", "application/json").setBody("{}")
                    }
                }
            val repo = RemoteAlertasRepository(retrofit(cliente()).create(AlertasApi::class.java), cache, EvaluarProximidadUseCase())
            val r = repo.evaluar(telemetria(), emptySet(), ahora) as EvaluacionAlerta.ConAlerta
            assertEquals(101, r.alerta.idPunto)
            assertTrue("debe marcarse como calculada en el cliente", r.calculadaEnCliente)
        }

    @Test
    fun `fallo del backend (HTTP 500) tambien cae al calculo local`() =
        runTest {
            cache.guardar(fcConPuntoEste())
            server.enqueue(MockResponse().setResponseCode(500).setBody("boom"))
            val repo = RemoteAlertasRepository(retrofit(cliente()).create(AlertasApi::class.java), cache, EvaluarProximidadUseCase())
            val r = repo.evaluar(telemetria(), emptySet(), ahora) as EvaluacionAlerta.ConAlerta
            assertEquals(101, r.alerta.idPunto)
            assertTrue(r.calculadaEnCliente)
        }
}
