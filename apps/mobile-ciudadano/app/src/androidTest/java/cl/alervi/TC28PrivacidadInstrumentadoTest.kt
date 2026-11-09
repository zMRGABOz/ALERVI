package cl.alervi

import android.app.NotificationManager
import cl.alervi.prueba.Prueba
import cl.alervi.prueba.PruebaInstrumentadaBase
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.flow.first
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.io.FileNotFoundException

/**
 * TC-28 / RNF-S-8: la posición del ciudadano no se filtra.
 *
 * Se ejecuta la evaluación completa con una coordenada sintética única y se
 * revisan Logcat del proceso, archivos locales y el texto de la notificación.
 * No se usan datos reales ni se persisten coordenadas.
 */
@HiltAndroidTest
class TC28PrivacidadInstrumentadoTest : PruebaInstrumentadaBase() {

    private val latitudSintetica = -36.8283456
    private val longitudSintetica = -73.0543456

    @Test
    fun tc28_coordenadasNoAparecenEnLogcatNiEnArchivos() {
        abrirAppConServicio()
        fuenteUbicacion.limpiar()
        fuenteUbicacion.emitir(
            Prueba.ubicacion(
                latitud = latitudSintetica,
                longitud = longitudSintetica,
                velocidadMps = 15f,
                rumboGrados = 0f,
            ),
        )

        // La alerta confirma que la telemetría recorrió todo el pipeline.
        val alerta =
            kotlinx.coroutines.runBlocking {
                kotlinx.coroutines.withTimeoutOrNull(10_000) {
                    busAvisos.alerta.first { it != null }
                }
            }
        assertNotNull("La evaluación sintética debe completar el flujo", alerta)

        // Margen para que Logcat y notificación se estabilicen.
        esperarHasta(1_000) { Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_ALERTA) }

        val logcat = Prueba.logcatDeLaApp()
        assertFalse(
            "RNF-S-8: la longitud no debe aparecer en Logcat",
            logcat.contains("0543456"),
        )
        assertFalse(
            "RNF-S-8: la latitud no debe aparecer en Logcat",
            logcat.contains("8283456"),
        )

        val archivos = Prueba.archivosDeLaApp()
        assertFalse("La app debe tener archivos locales de consentimiento", archivos.isEmpty())
        archivos.forEach { archivo ->
            // MapLibre crea y borra diarios transitorios (p. ej. mbgl-offline.db-journal)
            // mientras el mapa escribe; si desaparece entre el listado y la lectura,
            // no puede persistir coordenadas y no invalida RNF-S-8.
            val contenido =
                try {
                    archivo.readBytes().toString(Charsets.ISO_8859_1)
                } catch (_: FileNotFoundException) {
                    return@forEach
                }
            assertFalse(
                "RNF-S-8: ${archivo.name} no debe contener la longitud",
                contenido.contains("0543456"),
            )
            assertFalse(
                "RNF-S-8: ${archivo.name} no debe contener la latitud",
                contenido.contains("8283456"),
            )
        }

        val notificacion =
            contexto
                .getSystemService(NotificationManager::class.java)
                ?.activeNotifications
                ?.firstOrNull { it.id == Prueba.ID_NOTIFICACION_ALERTA }
        assertNotNull("La alerta visual debe estar publicada", notificacion)
        val textoNotificacion = notificacion!!.notification.extras?.toString().orEmpty()
        assertFalse(
            "RNF-S-8: la notificación no debe contener coordenadas",
            textoNotificacion.contains("0543456") || textoNotificacion.contains("8283456"),
        )
    }
}
