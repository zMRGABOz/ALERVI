package cl.alervi

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import cl.alervi.prueba.Prueba
import cl.alervi.prueba.PruebaInstrumentadaBase
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * TC-27: permiso de ubicación denegado.
 *
 * La app informa la limitación (mapa y Configuración), no afirma monitoreo
 * ni emite la notificación del FGS, y la navegación sigue operativa.
 */
@HiltAndroidTest
class TC27PermisoInstrumentadoTest : PruebaInstrumentadaBase() {

    @Test
    fun tc27_permisoDenegado_informaLimitacionSinBloquearLaUi() {
        // Android 14 mata el proceso al revocar el permiso real; se simula la
        // denegación por el mismo punto de consulta que usa la app.
        verificadorPermiso.denegar()
        lanzarConConsentimiento()

        esperarTexto(R.string.mapa_monitoreo_sin_permiso)
        composeRule.onNodeWithText(texto(R.string.mapa_monitoreo_sin_permiso)).assertIsDisplayed()
        composeRule.onAllNodesWithText(texto(R.string.mapa_monitoreo_activo)).assertCountEquals(0)
        assertFalse(
            "TC-27: sin permiso no puede existir la notificación de monitoreo",
            Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_MONITOREO),
        )

        // La interfaz no se bloquea: se puede navegar a Configuración.
        composeRule.onNodeWithText(texto(R.string.barra_pestana_ajustes)).performClick()
        esperarTexto(R.string.configuracion_ubicacion_denegada)
        composeRule.onNodeWithText(texto(R.string.configuracion_ubicacion_denegada)).assertIsDisplayed()
        composeRule.onNodeWithText(texto(R.string.configuracion_ubicacion_denegada_detalle)).assertIsDisplayed()

        // Y volver al mapa.
        composeRule.onNodeWithText(texto(R.string.barra_pestana_mapa)).performClick()
        esperarTexto(R.string.mapa_monitoreo_sin_permiso)
        assertTrue(Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_MONITOREO).not())
    }

    private fun esperarTexto(id: Int) {
        composeRule.waitUntil(20_000) {
            composeRule.onAllNodesWithText(texto(id)).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun texto(id: Int): String = contexto.getString(id)
}
