package cl.alervi.domain.sesion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas del dueño único de la sesión de alertas (RB-14, E1 §6).
 *
 * Cubre la concurrencia entre la interfaz y el servicio en primer plano:
 * una sola sesión, registro atómico y cierre explícito.
 */
class GestorSesionAlertasTest {

    private val gestor = GestorSesionAlertas()

    @Test
    fun `sin activar no hay sesion ni puntos advertidos`() {
        assertNull(gestor.idSesion())
        assertTrue(gestor.advertidos().isEmpty())
        assertFalse(gestor.registrarAdvertido(101))
    }

    @Test
    fun `activar dos veces conserva la misma sesion`() {
        val primera = gestor.activar()
        val segunda = gestor.activar()
        assertNotNull(gestor.idSesion())
        assertEquals(primera.idSesion, segunda.idSesion) // RB-14: no se reinicia
        assertEquals(primera.idSesion, gestor.idSesion())
    }

    @Test
    fun `un punto se registra una sola vez en la sesion`() {
        gestor.activar()
        assertTrue(gestor.registrarAdvertido(101))
        assertFalse(gestor.registrarAdvertido(101))
        assertEquals(setOf(101), gestor.advertidos())
    }

    @Test
    fun `desactivar cierra la sesion y limpia los advertidos`() {
        gestor.activar()
        gestor.registrarAdvertido(101)
        gestor.desactivar()
        assertNull(gestor.idSesion())
        assertTrue(gestor.advertidos().isEmpty())
        assertFalse(gestor.registrarAdvertido(101))
    }

    @Test
    fun `reactivar crea una sesion nueva con puntos habilitados`() {
        gestor.activar()
        gestor.registrarAdvertido(101)
        val primera = gestor.idSesion()
        gestor.desactivar()

        gestor.activar()
        assertTrue(gestor.idSesion() != primera)
        assertTrue(gestor.advertidos().isEmpty())
        assertTrue(gestor.registrarAdvertido(101))
    }
}
