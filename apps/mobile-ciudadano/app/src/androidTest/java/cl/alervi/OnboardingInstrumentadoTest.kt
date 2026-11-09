package cl.alervi

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ActivityScenario
import cl.alervi.prueba.Prueba
import cl.alervi.prueba.PruebaInstrumentadaBase
import cl.alervi.ui.MainActivity
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Onboarding, consentimiento informado y arranque del servicio (RF-8).
 *
 * Acción afirmativa (§5.3) → registro local versión+fecha → permiso ya
 * concedido → `ServicioAlertasProximidad` en primer plano → estado de
 * monitoreo activo → retiro del consentimiento detiene el servicio (RB-14).
 */
@HiltAndroidTest
class OnboardingInstrumentadoTest : PruebaInstrumentadaBase() {

    @Test
    fun onboarding_conSesionActiva_arrancaYDetieneElServicio() {
        Prueba.otorgarPermisos()

        escenario = ActivityScenario.launch(MainActivity::class.java)
        esperarTexto(R.string.bienvenida_comenzar)
        composeRule.onNodeWithText(texto(R.string.bienvenida_comenzar)).performClick()

        esperarTexto(R.string.consentimiento_activar)
        composeRule
            .onNodeWithText(texto(R.string.consentimiento_activar))
            .performScrollTo()
            .performClick()

        // La transición de navegación compone el nodo antes de que termine de
        // mostrarse; se espera a que esté realmente visible (evita flake).
        esperarMostrado(R.string.mapa_monitoreo_activo)
        assertTrue("El FGS no publicó su notificación", esperarServicioActivo())
        assertNotNull("RB-14: debe existir sesión de alertas", gestorSesion.sesion.value)

        val consentimiento =
            runBlocking {
                withTimeoutOrNull(5_000) { registro.flujo.first { it != null } }
            }
        assertNotNull("§5.3: debe registrarse versión y fecha del consentimiento", consentimiento)

        // Estado en Configuración (pantalla 06) y retiro del consentimiento.
        composeRule.onNodeWithText(texto(R.string.barra_pestana_ajustes)).performClick()
        esperarTexto(R.string.configuracion_ubicacion_concedida)
        esperarMostrado(R.string.configuracion_sesion_activa)

        composeRule
            .onNodeWithText(texto(R.string.configuracion_alertas_titulo))
            .performScrollTo()
            .performClick()

        assertTrue(
            "RB-14: al desactivar deben cerrarse sesión y consentimiento",
            esperarHasta(10_000) {
                gestorSesion.sesion.value == null &&
                    !Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_MONITOREO)
            },
        )
        assertNull(
            "§5.3: el retiro debe borrar el registro local",
            runBlocking { registro.actual() },
        )
    }

    private fun esperarTexto(id: Int) {
        composeRule.waitUntil(20_000) {
            composeRule.onAllNodesWithText(texto(id)).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /** Espera a que el texto exista y además esté visible (transiciones de NavHost). */
    private fun esperarMostrado(id: Int) {
        composeRule.waitUntil(20_000) {
            runCatching {
                composeRule.onNodeWithText(texto(id)).assertIsDisplayed()
            }.isSuccess
        }
    }

    private fun texto(id: Int): String = contexto.getString(id)
}
