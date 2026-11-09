package cl.alervi.data.local

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import cl.alervi.data.local.RegistroConsentimiento.Companion.VERSION_TEXTO_ACTUAL
import java.nio.file.Files
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pruebas del registro local de consentimiento Ley 21.719 (E1 §5.3 L837–842).
 * Almacena SOLO versión del texto + fecha (RNF-S-8: sin coordenadas).
 */
class RegistroConsentimientoTest {

    private fun crearRegistro(dir: java.io.File, scope: CoroutineScope): RegistroConsentimiento {
        val archivo = java.io.File(dir, "consentimiento.preferences_pb")
        return RegistroConsentimiento(
            PreferenceDataStoreFactory.create(scope = scope, produceFile = { archivo }),
        )
    }

    @Test
    fun `registrar guarda version del texto y fecha, y flujo las expone`() = runTest {
        val dir = Files.createTempDirectory("consent-alervi").toFile()
        val scope = CoroutineScope(StandardTestDispatcher(testScheduler) + Job())
        val registro = crearRegistro(dir, scope)

        assertNull(registro.actual()) // nunca aceptó

        registro.registrar(VERSION_TEXTO_ACTUAL, fechaMs = 1_772_000_000_000L)
        val actual = registro.actual()
        assertEquals(VERSION_TEXTO_ACTUAL, actual!!.versionTexto)
        assertEquals(1_772_000_000_000L, actual.fechaMs)
        scope.cancel()
    }

    @Test
    fun `retirar borra el registro local (desactivar alertas, retiro E1 5-3)`() = runTest {
        val dir = Files.createTempDirectory("consent-alervi").toFile()
        val scope = CoroutineScope(StandardTestDispatcher(testScheduler) + Job())
        val registro = crearRegistro(dir, scope)

        registro.registrar("version-anterior", 1L)
        registro.retirar()
        assertNull(registro.actual())
        scope.cancel()
    }
}
