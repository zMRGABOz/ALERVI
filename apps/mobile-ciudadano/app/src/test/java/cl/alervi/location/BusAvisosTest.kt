package cl.alervi.location

import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PatronSonoro
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Canal en memoria entre el FGS y la UI (RD-04); sin persistencia (RNF-S-8). */
class BusAvisosTest {

    private val alerta =
        AlertaProximidad(
            idPunto = 101,
            nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
            nivelRiesgo = NivelRiesgo.ALTO,
            distanciaM = 130.0,
            ttcSegundos = 8.7,
            mensajeVisual = "Zona de riesgo a 130 m",
            patronSonoro = PatronSonoro.BEEP_PRECAUCION,
            instruccionSeguridad = "Reduzca la velocidad",
        )

    @Test
    fun `publicar expone la alerta vigente`() {
        val bus = BusAvisos()

        bus.publicar(alerta)

        assertEquals(alerta, bus.alerta.value)
    }

    @Test
    fun `limpiar oculta la alerta`() {
        val bus = BusAvisos()
        bus.publicar(alerta)

        bus.limpiar()

        assertNull(bus.alerta.value)
    }
}
