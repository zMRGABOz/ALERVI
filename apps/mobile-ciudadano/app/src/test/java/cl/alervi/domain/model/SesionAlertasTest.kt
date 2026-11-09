package cl.alervi.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas de la sesión de alertas (RB-14, E1 §6).
 */
class SesionAlertasTest {

    @Test
    fun `un punto advertido queda registrado en la sesion`() {
        val sesion = SesionAlertas()
        assertFalse(sesion.yaAdvertido(101))
        sesion.registrarAdvertido(101)
        assertTrue(sesion.yaAdvertido(101))
        assertEquals(setOf(101), sesion.puntosAdvertidos)
    }

    @Test
    fun `el conjunto expuesto es inmutable hacia fuera`() {
        val sesion = SesionAlertas()
        sesion.registrarAdvertido(101)
        val copia = sesion.puntosAdvertidos
        // Mutar la copia no afecta la sesión (defensa de RB-14).
        runCatching { (copia as MutableSet<Int>).add(999) }
        assertFalse(sesion.yaAdvertido(999))
    }

    @Test
    fun `reiniciar crea una sesion nueva que rehabilita puntos advertidos`() {
        val sesion = SesionAlertas()
        sesion.registrarAdvertido(101)
        val nueva = sesion.reiniciar()
        assertFalse(nueva.yaAdvertido(101)) // RB-14: nueva sesión rehabilita
        assertTrue(nueva.idSesion != sesion.idSesion)
    }
}
