package cl.alervi.location

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import cl.alervi.R
import cl.alervi.data.repository.AlertasRepository
import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.sesion.GestorSesionAlertas
import cl.alervi.domain.usecase.DecisionAviso
import cl.alervi.domain.usecase.PoliticaAvisos
import cl.alervi.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Evaluación de proximidad en marcha (RF-8, RB-13, RB-14, RD-04).
 *
 * ForegroundService de tipo `location`: mantiene la telemetría y la
 * evaluación activas con la pantalla bloqueada o la app en segundo plano,
 * sin exigir interacción manual.
 *
 * Flujo por cada muestra de ubicación:
 *  1. se construye la [Telemetria] SOLO en memoria (RNF-S-8);
 *  2. [AlertasRepository] aplica RB-13 (velocidad, dirección, TTC, validez);
 *  3. [PoliticaAvisos] aplica RB-14 (sesión, un aviso por punto, exclusión
 *     mutua de audio);
 *  4. si corresponde, se publica el aviso visual ([BusAvisos]), se muestra la
 *     notificación de alerta y se reproduce el patrón sonoro.
 *
 * La posición NO se persiste ni se escribe en Logcat (RNF-S-8); por eso este
 * archivo no registra coordenadas en ningún punto.
 */
@AndroidEntryPoint
class ServicioAlertasProximidad : Service() {

    @Inject
    lateinit var alertasRepository: AlertasRepository

    @Inject
    lateinit var gestorSesion: GestorSesionAlertas

    @Inject
    lateinit var busAvisos: BusAvisos

    @Inject
    lateinit var reproductor: ReproductorAvisos

    @Inject
    lateinit var fuenteUbicacion: FuenteUbicacion

    private val alcance = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var evaluacionActiva: Job? = null

    private var despertar: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        crearCanalesDeNotificacion()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        // Sin sesión de alertas o sin permiso no hay monitoreo que sostener
        // (TC-27: nunca se afirma monitoreo sin ubicación disponible).
        if (gestorSesion.sesion.value == null || !tienePermisoUbicacion()) {
            detenerServicio()
            return START_NOT_STICKY
        }

        iniciarPrimerPlano()
        adquirirDespertar()
        if (evaluacionActiva == null) {
            evaluacionActiva = alcance.launch { evaluarUbicaciones() }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        evaluacionActiva?.cancel()
        evaluacionActiva = null
        alcance.cancel()
        liberarDespertar()
        super.onDestroy()
    }

    /** Bucle de telemetría → RB-13 → RB-14 → aviso (RB-14: sin superposición). */
    private suspend fun evaluarUbicaciones() {
        fuenteUbicacion.actualizaciones().collect { ubicacion ->
            val idSesion = gestorSesion.idSesion()
            if (idSesion == null) {
                detenerServicio()
                return@collect
            }

            val telemetria = ubicacion.aTelemetria(idSesion)
            val resultado =
                runCatching {
                    alertasRepository.evaluar(
                        telemetria = telemetria,
                        puntosYaAdvertidos = gestorSesion.advertidos(),
                        ahoraMs = System.currentTimeMillis(),
                    )
                }.getOrNull() ?: return@collect

            val decision =
                PoliticaAvisos.decidir(
                    evaluacion = resultado,
                    sesionActiva = gestorSesion.idSesion() != null,
                    puntosAdvertidos = gestorSesion.advertidos(),
                    audioOcupado = reproductor.estaOcupado,
                )

            if (decision is DecisionAviso.Emitir) {
                emitirAviso(decision.alerta)
            }
        }
    }

    /**
     * Emite el aviso sonoro y visual. El audio se reserva ANTES de marcar el
     * punto para no perder la advertencia si otro aviso está en curso; si el
     * punto ya estaba advertido, se libera el canal sin emitir (RB-14).
     */
    private fun emitirAviso(alerta: AlertaProximidad) {
        if (!reproductor.tomar()) return
        if (!gestorSesion.registrarAdvertido(alerta.idPunto)) {
            reproductor.liberar()
            return
        }

        busAvisos.publicar(alerta)
        publicarNotificacionDeAlerta(alerta)
        alcance.launch {
            try {
                reproductor.reproducir(alerta.patronSonoro)
            } finally {
                reproductor.liberar()
            }
        }
    }

    // -----------------------------------------------------------------------
    // Primer plano y notificaciones
    // -----------------------------------------------------------------------

    private fun iniciarPrimerPlano() {
        val tipo =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                0
            }
        ServiceCompat.startForeground(
            this,
            ID_NOTIFICACION_MONITOREO,
            construirNotificacionMonitoreo(),
            tipo,
        )
    }

    private fun construirNotificacionMonitoreo(): Notification =
        NotificationCompat
            .Builder(this, CANAL_MONITOREO)
            .setSmallIcon(R.drawable.ic_estado_alervi)
            .setContentTitle(getString(R.string.servicio_titulo))
            .setContentText(getString(R.string.servicio_detalle))
            .setContentIntent(intentAbrirApp())
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()

    @SuppressLint("MissingPermission") // se verifica POST_NOTIFICATIONS antes de notificar
    private fun publicarNotificacionDeAlerta(alerta: AlertaProximidad) {
        if (!puedeNotificar()) return
        val notificacion =
            NotificationCompat
                .Builder(this, CANAL_ALERTAS)
                .setSmallIcon(R.drawable.ic_estado_alervi)
                .setContentTitle(getString(R.string.alerta_rotulo))
                .setContentText(alerta.mensajeVisual)
                .setStyle(NotificationCompat.BigTextStyle().bigText(alerta.mensajeVisual))
                .setContentIntent(intentAbrirApp())
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setTimeoutAfter(TIEMPO_NOTIFICACION_ALERTA_MS)
                .build()
        NotificationManagerCompat.from(this).notify(ID_NOTIFICACION_ALERTA, notificacion)
    }

    private fun puedeNotificar(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED

    private fun intentAbrirApp(): PendingIntent {
        val intent =
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        return PendingIntent.getActivity(
            this,
            SOLICITUD_ABRIR_APP,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private fun crearCanalesDeNotificacion() {
        val administrador = getSystemService(NotificationManager::class.java) ?: return

        val monitoreo =
            NotificationChannel(
                CANAL_MONITOREO,
                getString(R.string.servicio_canal_monitoreo),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.servicio_canal_monitoreo_descripcion)
                setShowBadge(false)
            }

        val alertas =
            NotificationChannel(
                CANAL_ALERTAS,
                getString(R.string.servicio_canal_alertas),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = getString(R.string.servicio_canal_alertas_descripcion)
                // El sonido lo reproduce ReproductorAvisos (exclusión mutua);
                // el canal no debe duplicarlo.
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

        administrador.createNotificationChannel(monitoreo)
        administrador.createNotificationChannel(alertas)
    }

    // -----------------------------------------------------------------------
    // Permiso, wake lock y parada
    // -----------------------------------------------------------------------

    private fun tienePermisoUbicacion(): Boolean =
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

    /**
     * Mantiene la CPU despierta mientras la sesión está activa para que la
     * evaluación siga con la pantalla bloqueada (RD-04). Se libera al parar
     * el servicio; el timeout es una salvaguarda ante una parada anómala.
     */
    @SuppressLint("WakelockTimeout")
    private fun adquirirDespertar() {
        if (despertar?.isHeld == true) return
        val energia = getSystemService(PowerManager::class.java) ?: return
        despertar =
            energia
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, ETIQUETA_DESPERTAR)
                .apply {
                    setReferenceCounted(false)
                    acquire(TIEMPO_DESPERTAR_MS)
                }
    }

    private fun liberarDespertar() {
        despertar?.let { bloqueo ->
            if (bloqueo.isHeld) bloqueo.release()
        }
        despertar = null
    }

    private fun detenerServicio() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val CANAL_MONITOREO = "alervi_monitoreo"
        private const val CANAL_ALERTAS = "alervi_alertas"

        private const val ID_NOTIFICACION_MONITOREO = 1_001
        private const val ID_NOTIFICACION_ALERTA = 1_002
        private const val SOLICITUD_ABRIR_APP = 2_001

        private const val TIEMPO_NOTIFICACION_ALERTA_MS = 10_000L
        private const val TIEMPO_DESPERTAR_MS = 4 * 60 * 60 * 1_000L
        private const val ETIQUETA_DESPERTAR = "ALERVI:monitoreo-alertas"

        /**
         * Inicia el monitoreo si la sesión y el permiso están vigentes.
         * Se invoca desde la interfaz en primer plano (Android 12+ restringe
         * iniciar un ForegroundService desde segundo plano).
         */
        fun iniciar(contexto: Context) {
            if (!tienePermiso(contexto)) return
            val intencion = Intent(contexto, ServicioAlertasProximidad::class.java)
            runCatching { ContextCompat.startForegroundService(contexto, intencion) }
        }

        /** Detiene el monitoreo (retiro del consentimiento o permiso revocado). */
        fun detener(contexto: Context) {
            contexto.stopService(Intent(contexto, ServicioAlertasProximidad::class.java))
        }

        private fun tienePermiso(contexto: Context): Boolean =
            ContextCompat.checkSelfPermission(
                contexto,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
    }
}

/**
 * Traducción de la muestra de GPS a la telemetría del contrato
 * `AlertCheckRequest`. Solo existe en memoria (RNF-S-8).
 */
private fun Location.aTelemetria(idSesion: String): Telemetria =
    Telemetria(
        idSesion = idSesion,
        latitud = latitude,
        longitud = longitude,
        velocidadMps = if (hasSpeed()) speed.toDouble() else 0.0,
        rumboGrados = if (hasBearing()) bearing.toDouble() else null,
        precisionM = if (hasAccuracy()) accuracy.toDouble() else null,
        timestampMs = if (time > 0L) time else System.currentTimeMillis(),
    )
