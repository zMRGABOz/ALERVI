package cl.alervi.prueba

import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.domain.sesion.GestorSesionAlertas
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import cl.alervi.location.BusAvisos
import cl.alervi.location.ReproductorAvisos
import cl.alervi.location.ServicioAlertasProximidad
import cl.alervi.ui.MainActivity
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Rule

/**
 * Base de las pruebas instrumentadas.
 *
 * Aísla cada prueba: cierra la actividad, detiene el servicio, cierra la
 * sesión RB-14, limpia notificaciones, consentimiento y ubicaciones
 * sintéticas pendientes. La regla de Compose no lanza actividad; cada prueba
 * controla el arranque de [MainActivity] para preparar permisos y estado.
 */
abstract class PruebaInstrumentadaBase {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule: ComposeTestRule = createEmptyComposeRule()

    protected var escenario: ActivityScenario<MainActivity>? = null

    protected val contexto get() = Prueba.contexto()

    private val entrada by lazy {
        EntryPointAccessors.fromApplication(contexto, PuntoEntradaPrueba::class.java)
    }

    protected val registro: RegistroConsentimiento get() = entrada.registroConsentimiento()

    protected val gestorSesion: GestorSesionAlertas get() = entrada.gestorSesionAlertas()

    protected val busAvisos: BusAvisos get() = entrada.busAvisos()

    protected val reproductor: ReproductorAvisos get() = entrada.reproductorAvisos()

    protected val fuenteUbicacion: FuenteUbicacionPrueba get() = entrada.fuenteUbicacionPrueba()

    protected val verificadorPermiso: VerificadorPermisoPrueba
        get() = entrada.verificadorPermisoPrueba()

    protected val evaluarProximidad: EvaluarProximidadUseCase get() = entrada.evaluarProximidad()

    @Before
    open fun prepararBase() {
        // Por si una prueba anterior dejó el servicio en marcha.
        ServicioAlertasProximidad.detener(contexto)
        gestorSesion.desactivar()
        busAvisos.limpiar()
        Prueba.cancelarNotificaciones()
        esperarHasta(2_000) { !Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_MONITOREO) }
        runBlocking { registro.retirar() }
        fuenteUbicacion.limpiar()
        verificadorPermiso.conceder()
    }

    @After
    open fun limpiarBase() {
        escenario?.close()
        escenario = null
        ServicioAlertasProximidad.detener(contexto)
        gestorSesion.desactivar()
        busAvisos.limpiar()
        Prueba.cancelarNotificaciones()
        runBlocking { registro.retirar() }
        fuenteUbicacion.limpiar()
        verificadorPermiso.conceder()
    }

    /** Lanza la app con consentimiento ya registrado (flujo de reapertura). */
    protected fun lanzarConConsentimiento() {
        runBlocking {
            registro.registrar(
                RegistroConsentimiento.VERSION_TEXTO_ACTUAL,
                System.currentTimeMillis(),
            )
        }
        escenario = ActivityScenario.launch(MainActivity::class.java)
    }

    /**
     * Espera con bombeo de frames de Compose.
     *
     * `composeRule.waitUntil` avanza el reloj de prueba y la recomposición; una
     * espera activa con `SystemClock.sleep` dejaría congelados los efectos
     * (`LifecycleEventEffect`) y las pantallas nunca se actualizarían.
     */
    protected fun esperarHasta(
        timeoutMs: Long = 10_000,
        condicion: () -> Boolean,
    ): Boolean =
        try {
            composeRule.waitUntil(timeoutMs) { condicion() }
            true
        } catch (_: ComposeTimeoutException) {
            false
        }

    /** Espera a que el FGS publique su notificación persistente. */
    protected fun esperarServicioActivo(timeoutMs: Long = 20_000): Boolean =
        esperarHasta(timeoutMs) {
            Prueba.notificacionActiva(Prueba.ID_NOTIFICACION_MONITOREO)
        }

    /** Prepara permisos + consentimiento y abre la app (servicio en marcha). */
    protected fun abrirAppConServicio() {
        Prueba.otorgarPermisos()
        lanzarConConsentimiento()
        check(esperarServicioActivo()) { "El servicio de alertas no inició en 20 s" }
    }
}
