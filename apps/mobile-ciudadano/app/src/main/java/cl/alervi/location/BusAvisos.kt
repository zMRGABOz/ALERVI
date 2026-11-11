package cl.alervi.location

import cl.alervi.domain.model.AlertaProximidad
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Canal único entre la evaluación en marcha y la interfaz (RD-04).
 *
 * El [ServicioAlertasProximidad] publica aquí el aviso para que la pantalla
 * de alerta (05) lo muestre sobre la navegación sin exigir interacción.
 * El [cl.alervi.ui.viewmodel.AppViewModel] lo observa y lo descarta cuando el
 * conductor vuelve al mapa.
 *
 * Solo contiene la alerta vigente en memoria: NO se persiste ni incluye
 * coordenadas del ciudadano (RNF-S-8).
 */
@Singleton
class BusAvisos
    @Inject
    constructor() {

        private val _alerta = MutableStateFlow<AlertaProximidad?>(null)

        /** Alerta visual vigente, o null si no hay ninguna por mostrar. */
        val alerta: StateFlow<AlertaProximidad?> = _alerta.asStateFlow()

        fun publicar(alerta: AlertaProximidad) {
            _alerta.value = alerta
        }

        /** El conductor volvió al mapa (o se desactivaron las alertas). */
        fun limpiar() {
            _alerta.value = null
        }
    }
