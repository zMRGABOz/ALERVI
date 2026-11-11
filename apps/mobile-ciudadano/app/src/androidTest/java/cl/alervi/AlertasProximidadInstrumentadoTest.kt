package cl.alervi

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.domain.model.Telemetria
import cl.alervi.prueba.Prueba
import cl.alervi.prueba.PruebaInstrumentadaBase
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * TC-22, TC-23 y TC-29 sobre el servicio real de proximidad.
 *
 * Las ubicaciones son sintéticas y solo viven en memoria (RNF-S-8). El flavor
 * `mock` evalúa los fixtures locales con el mismo caso de uso RB-13/RB-14 que
 * usa el respaldo del flavor `local`.
 */
@HiltAndroidTest
class AlertasProximidadInstrumentadoTest : PruebaInstrumentadaBase() {

    // Punto 101 del fixture: (-73.0543, -36.8271), ALTO.
    private val lonPunto101 = -73.0543
    private val latCercaDelPunto101 = -36.8283 // ~134 m al sur
    private val latAntesDelTtc = -36.8295 // ~267 m al sur → TTC > 12 s a 15 m/s

    @Test
    fun tc22_aproximacionConvergenteEmiteAlertaVisualYSonoraSinInteraccion() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latCercaDelPunto101,
                longitud = lonPunto101,
                velocidadMps = 15f,
                rumboGrados = 0f,
            ),
        )

        val alerta = esperarAlerta()
        assertNotNull("TC-22: debe emitirse la alerta sin interacción", alerta)
        assertEquals(101, alerta!!.idPunto)
        assertTrue(
            "TC-22: el canal sonoro debe reservarse para reproducir el aviso",
            reproductor.estaOcupado || esperarHasta(1_500) { reproductor.estaOcupado },
        )
        assertTrue(
            "TC-22: la notificación de alerta debe publicarse",
            esperarHasta(5_000) { Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_ALERTA) },
        )

        composeRule.waitUntil(10_000) {
            composeRule
                .onAllNodesWithText(contexto.getString(R.string.alerta_rotulo))
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        composeRule
            .onNodeWithText(contexto.getString(R.string.alerta_rotulo))
            .assertIsDisplayed()
        composeRule
            .onNodeWithText("Av. Paicaví con Av. Los Carrera")
            .assertIsDisplayed()
    }

    @Test
    fun tc23_velocidadBajaNoEmiteAlerta() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latCercaDelPunto101,
                longitud = lonPunto101,
                velocidadMps = 0.5f,
                rumboGrados = 0f,
            ),
        )

        assertNull("TC-23: velocidad < 1,38 m/s no debe advertir", esperarAlerta(2_500))
        assertTrue("RB-14: no debe registrarse un punto advertido", gestorSesion.advertidos().isEmpty())
        assertFalse(Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_ALERTA))
    }

    @Test
    fun tc23_ttcMayorA12SegundosNoEmiteAlerta() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latAntesDelTtc,
                longitud = lonPunto101,
                velocidadMps = 15f,
                rumboGrados = 0f,
            ),
        )

        assertNull("TC-23: TTC > 12 s no debe advertir todavía", esperarAlerta(2_500))
        assertTrue(gestorSesion.advertidos().isEmpty())
    }

    @Test
    fun tc23_trayectoriaDivergenteNoEmiteAlerta() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latCercaDelPunto101,
                longitud = lonPunto101,
                velocidadMps = 15f,
                rumboGrados = 180f, // alejándose del punto
            ),
        )

        assertNull("TC-23: trayectoria divergente no debe advertir", esperarAlerta(2_500))
        assertTrue(gestorSesion.advertidos().isEmpty())
    }

    @Test
    fun tc29_puntoYaAdvertidoNoRepiteAvisoEnLaSesion() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latCercaDelPunto101,
                longitud = lonPunto101,
                velocidadMps = 15f,
                rumboGrados = 0f,
            ),
        )

        assertNotNull("La primera aproximación debe advertir", esperarAlerta())
        assertTrue("RB-14: el punto 101 queda advertido", 101 in gestorSesion.advertidos())
        assertTrue(
            "La reproducción debe terminar antes de reevaluar",
            esperarHasta(3_000) { !reproductor.estaOcupado },
        )

        // El conductor descarta el aviso; la sesión conserva el punto advertido.
        busAvisos.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latCercaDelPunto101,
                longitud = lonPunto101,
                velocidadMps = 15f,
                rumboGrados = 0f,
                tiempoMs = System.currentTimeMillis() + 1_000,
            ),
        )

        assertNull("TC-29: el mismo punto NO debe repetir aviso", esperarAlerta(2_500))
        assertEquals(setOf(101), gestorSesion.advertidos())
    }

    @Test
    fun tc29_menorTtcYDesempatePorIdPunto() {
        val ahora = System.currentTimeMillis()
        val lonBase = -73.05
        val latBase = -36.83
        val mPorGradoLon = 89_080.0
        val mPorGradoLat = 111_320.0

        fun punto(
            id: Int,
            metrosEste: Double,
            metrosNorte: Double = 0.0,
        ) = PuntoCritico(
            idPunto = id,
            longitud = lonBase + metrosEste / mPorGradoLon,
            latitud = latBase + metrosNorte / mPorGradoLat,
            nombreInterseccion = "Punto $id",
            comuna = "Concepción",
            nivelRiesgo = NivelRiesgo.ALTO,
            indicePrioridad = 50.0,
            totalSiniestros = 10,
        )

        val telemetria =
            Telemetria(
                idSesion = "sesion-prueba",
                latitud = latBase,
                longitud = lonBase,
                velocidadMps = 13.889,
                rumboGrados = 90.0,
                precisionM = 5.0,
                timestampMs = ahora,
            )

        val menorTtc =
            evaluarProximidad.evaluar(
                telemetria = telemetria,
                puntos = listOf(punto(201, 100.0), punto(202, 60.0)),
                puntosYaAdvertidos = emptySet(),
                ahoraMs = ahora,
            ) as EvaluacionAlerta.ConAlerta
        assertEquals("TC-29: gana el menor TTC", 202, menorTtc.alerta.idPunto)

        val empate =
            evaluarProximidad.evaluar(
                telemetria = telemetria,
                puntos = listOf(punto(301, 100.0, 5.0), punto(205, 100.0, -5.0)),
                puntosYaAdvertidos = emptySet(),
                ahoraMs = ahora,
            ) as EvaluacionAlerta.ConAlerta
        assertEquals("TC-29: empate se resuelve por menor id_punto", 205, empate.alerta.idPunto)

        val repetido =
            evaluarProximidad.evaluar(
                telemetria = telemetria,
                puntos = listOf(punto(101, 60.0)),
                puntosYaAdvertidos = setOf(101),
                ahoraMs = ahora,
            ) as EvaluacionAlerta.Suprimida
        assertEquals(
            MotivoSupresion.SUPRIMIDO_PUNTO_YA_ADVERTIDO,
            repetido.motivo,
        )
    }

    private fun esperarAlerta(timeoutMs: Long = 10_000) =
        runBlocking {
            withTimeoutOrNull(timeoutMs) {
                busAvisos.alerta.first { it != null }
            }
        }
}
