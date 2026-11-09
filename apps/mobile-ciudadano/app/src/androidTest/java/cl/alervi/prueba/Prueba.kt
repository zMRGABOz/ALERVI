package cl.alervi.prueba

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.location.Location
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.core.app.NotificationManagerCompat
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import cl.alervi.BuildConfig
import java.io.File

/**
 * Utilidades comunes de las pruebas instrumentadas.
 *
 * Todas las posiciones son sintéticas y viven en memoria; las utilidades de
 * privacidad (TC-28) inspeccionan Logcat y archivos de la app.
 */
object Prueba {
    const val ID_NOTIFICACION_MONITOREO = 1_001
    const val ID_NOTIFICACION_ALERTA = 1_002

    fun contexto(): Context = ApplicationProvider.getApplicationContext()

    private fun uiAutomation() = InstrumentationRegistry.getInstrumentation().uiAutomation

    /** Concede ubicación precisa y notificaciones para los flujos afirmativos. */
    fun otorgarPermisos() {
        uiAutomation().grantRuntimePermission(
            BuildConfig.APPLICATION_ID,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            uiAutomation().grantRuntimePermission(
                BuildConfig.APPLICATION_ID,
                Manifest.permission.POST_NOTIFICATIONS,
            )
        }
    }

    /**
     * Construye una muestra de GPS sintética.
     *
     * @param rumboGrados 0 = Norte, 90 = Este.
     */
    fun ubicacion(
        latitud: Double,
        longitud: Double,
        velocidadMps: Float,
        rumboGrados: Float,
        precisionM: Float = 5f,
        tiempoMs: Long = System.currentTimeMillis(),
    ): Location =
        Location(PROVEEDOR_SINTETICO).apply {
            latitude = latitud
            longitude = longitud
            accuracy = precisionM
            speed = velocidadMps
            bearing = rumboGrados
            time = tiempoMs
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }

    fun notificacionActiva(id: Int): Boolean =
        contexto()
            .getSystemService(NotificationManager::class.java)
            ?.activeNotifications
            ?.any { it.id == id } == true

    fun cancelarNotificaciones() {
        NotificationManagerCompat.from(contexto()).cancelAll()
    }

    /** Espera activa acotada; no bloquea el hilo principal de la app. */
    fun esperarHasta(
        timeoutMs: Long = 10_000,
        condicion: () -> Boolean,
    ): Boolean {
        val fin = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < fin) {
            if (condicion()) return true
            SystemClock.sleep(50)
        }
        return condicion()
    }

    /** Logcat del proceso de la app (no del sistema), sin coordenadas esperadas. */
    fun logcatDeLaApp(): String = ejecutarComandoShell("logcat -d -v brief --pid=${android.os.Process.myPid()}")

    /** Archivos de datos de la app, excluyendo caché de código nativo. */
    fun archivosDeLaApp(): List<File> =
        contexto()
            .dataDir
            .walkTopDown()
            .onEnter { !it.name.equals("code_cache", ignoreCase = true) }
            .filter { it.isFile }
            .toList()

    private fun ejecutarComandoShell(comando: String): String =
        ParcelFileDescriptor.AutoCloseInputStream(uiAutomation().executeShellCommand(comando))
            .bufferedReader()
            .use { it.readText() }

    private const val PROVEEDOR_SINTETICO = "prueba-alervi"
}
