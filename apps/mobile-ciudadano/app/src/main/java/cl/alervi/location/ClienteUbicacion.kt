package cl.alervi.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Fuente de telemetría del dispositivo para la sesión de alertas (RF-8).
 *
 * Usa `FusedLocationProviderClient` (gratuito, sin clave: RD-01) con
 * prioridad de alta precisión. La posición se entrega SOLO en memoria al
 * [ServicioAlertasProximidad]; no se escribe en disco, DataStore, archivos ni
 * Logcat (RNF-S-8).
 *
 * No se solicita `ACCESS_BACKGROUND_LOCATION`: la evaluación corre en un
 * ForegroundService de tipo `location`, por lo que el permiso de ubicación
 * «mientras se usa la app» basta incluso con la pantalla bloqueada.
 */
@Singleton
class ClienteUbicacion
    @Inject
    constructor(
        @ApplicationContext private val contexto: Context,
    ) : FuenteUbicacion {
        private val cliente = LocationServices.getFusedLocationProviderClient(contexto)

        /**
         * Flujo frío de posiciones. Cada colección registra y da de baja su
         * propio callback; al cancelar el servicio se dejan de pedir updates.
         */
        @SuppressLint("MissingPermission")
        override fun actualizaciones(): Flow<Location> =
            callbackFlow {
                if (!permisoConcedido()) {
                    close(SecurityException("Sin permiso de ubicación"))
                    return@callbackFlow
                }

                val peticion =
                    LocationRequest
                        .Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVALO_MS)
                        .setMinUpdateIntervalMillis(INTERVALO_MINIMO_MS)
                        .setMinUpdateDistanceMeters(0f)
                        .setWaitForAccurateLocation(false)
                        .build()

                val callback =
                    object : LocationCallback() {
                        override fun onLocationResult(resultado: LocationResult) {
                            resultado.lastLocation?.let { ubicacion ->
                                // Si el consumidor no alcanza a leer, se descarta la muestra:
                                // RB-13 exige datos frescos (antigüedad ≤ 5 s).
                                trySend(ubicacion)
                            }
                        }
                    }

                try {
                    cliente
                        .requestLocationUpdates(peticion, callback, Looper.getMainLooper())
                        .addOnFailureListener { error -> close(error) }
                } catch (error: SecurityException) {
                    close(error)
                    return@callbackFlow
                }

                awaitClose { cliente.removeLocationUpdates(callback) }
            }

        private fun permisoConcedido(): Boolean =
            ContextCompat.checkSelfPermission(
                contexto,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        private companion object {
            /** Frecuencia de evaluación; RB-13 tolera datos de hasta 5 s. */
            const val INTERVALO_MS = 1_000L
            const val INTERVALO_MINIMO_MS = 500L
        }
    }
