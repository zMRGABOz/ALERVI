package cl.alervi.domain.usecase

import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PatronSonoro
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas de la política de emisión (RB-14; TC-29 del catálogo E1 §11.2).
 *
 * Verifica sesión activa, un aviso por punto y exclusión mutua de audio,
 * que son las reglas que el servicio en primer plano aplica por muestra GPS.
 */
class PoliticaAvisosTest {

    private val alerta =
        AlertaProximidad(
            idPunto = 101,
            nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
            nivelRiesgo = NivelRiesgo.ALTO,
            distanciaM = 120.0,
            ttcSegundos = 8.0,
            mensajeVisual = "⚠️ Zona de riesgo a 120 m",
            patronSonoro = PatronSonoro.BEEP_PRECAUCION,
        )

    private fun conAlerta() = EvaluacionAlerta.ConAlerta(alerta = alerta, calculadaEnCliente = false)

    @Test
    fun `emite cuando hay sesion, el punto es nuevo y el audio esta libre`() {
        val decision =
            PoliticaAvisos.decidir(
                evaluacion = conAlerta(),
                sesionActiva = true,
                puntosAdvertidos = emptySet(),
                audioOcupado = false,
            )
        assertTrue(decision is DecisionAviso.Emitir)
        assertEquals(alerta, (decision as DecisionAviso.Emitir).alerta)
    }

    @Test
    fun `no emite sin sesion activa`() {
        val decision =
            PoliticaAvisos.decidir(
                evaluacion = conAlerta(),
                sesionActiva = false,
                puntosAdvertidos = emptySet(),
                audioOcupado = false,
            )
        assertEquals(
            DecisionAviso.Omitir(MotivoOmisionAviso.SIN_SESION),
            decision,
        )
    }

    @Test
    fun `no emite cuando RB-13 suprimio la alerta`() {
        val decision =
            PoliticaAvisos.decidir(
                evaluacion = EvaluacionAlerta.Suprimida(MotivoSupresion.SUPRIMIDO_VELOCIDAD_BAJA),
                sesionActiva = true,
                puntosAdvertidos = emptySet(),
                audioOcupado = false,
            )
        assertEquals(
            DecisionAviso.Omitir(MotivoOmisionAviso.SIN_ALERTA),
            decision,
        )
    }

    @Test
    fun `no repite el aviso de un punto ya advertido en la sesion`() {
        val decision =
            PoliticaAvisos.decidir(
                evaluacion = conAlerta(),
                sesionActiva = true,
                puntosAdvertidos = setOf(101),
                audioOcupado = false,
            )
        assertEquals(
            DecisionAviso.Omitir(MotivoOmisionAviso.PUNTO_YA_ADVERTIDO),
            decision,
        )
    }

    @Test
    fun `no superpone avisos mientras hay audio en reproduccion`() {
        val decision =
            PoliticaAvisos.decidir(
                evaluacion = conAlerta(),
                sesionActiva = true,
                puntosAdvertidos = emptySet(),
                audioOcupado = true,
            )
        assertEquals(
            DecisionAviso.Omitir(MotivoOmisionAviso.AUDIO_OCUPADO),
            decision,
        )
    }
}
