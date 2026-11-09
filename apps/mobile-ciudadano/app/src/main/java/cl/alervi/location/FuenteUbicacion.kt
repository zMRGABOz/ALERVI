package cl.alervi.location

import android.location.Location
import kotlinx.coroutines.flow.Flow

/**
 * Fuente de telemetría del dispositivo (RF-8).
 *
 * Abstracción mínima sobre `FusedLocationProviderClient` para poder sustituir
 * la fuente por ubicaciones sintéticas en las pruebas instrumentadas, sin
 * solicitar permisos ni depender del GPS real del emulador.
 *
 * La posición se entrega SOLO en memoria (RNF-S-8).
 */
interface FuenteUbicacion {
    /** Flujo frío de posiciones; cada colección registra y da de baja su callback. */
    fun actualizaciones(): Flow<Location>
}
