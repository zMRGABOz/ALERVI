package cl.alervi.prueba

import android.location.Location
import cl.alervi.location.FuenteUbicacion
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow

/**
 * Fuente de ubicación sintética para las pruebas instrumentadas.
 *
 * Las posiciones viven SOLO en memoria durante el test (RNF-S-8): no se
 * solicitan permisos de GPS real ni se persisten coordenadas.
 */
@Singleton
class FuenteUbicacionPrueba
    @Inject
    constructor() : FuenteUbicacion {
        private val canal = Channel<Location>(Channel.UNLIMITED)

        override fun actualizaciones(): Flow<Location> = canal.receiveAsFlow()

        /** Encola una muestra sintética para el servicio en marcha. */
        fun emitir(ubicacion: Location) {
            canal.trySend(ubicacion)
        }

        /** Descarta muestras pendientes entre pruebas. */
        fun limpiar() {
            while (canal.tryReceive().isSuccess) {
                // vaciar el canal sin bloquear
            }
        }
    }
