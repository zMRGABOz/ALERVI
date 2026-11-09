package cl.alervi.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.ui.estado.EstadoMapa
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel del mapa público de puntos críticos (RF-2).
 *
 * RB-1 (E1 §6): zona piloto = comuna de Concepción.
 *
 * La distinción entre «consulta exitosa sin resultados» (TC-06) y
 * «falla de consulta» (TC-07) es obligatoria (E1 §11.2): nunca se interpreta
 * la lista vacía como ausencia de riesgo (RB-2), ni la falla como caso vacío.
 */
@HiltViewModel
class MapaViewModel
@Inject
constructor(
    private val puntosRepository: PuntosRepository,
) : ViewModel() {

    private val _estado = MutableStateFlow<EstadoMapa>(EstadoMapa.Cargando)

    /** Estado que consume la pantalla pura del mapa (pantalla 03). */
    val estado: StateFlow<EstadoMapa> = _estado.asStateFlow()

    private var cargaActiva: Job? = null

    init {
        cargar()
    }

    /** Recarga la capa pública (también usado por el botón «reintentar» de TC-07). */
    fun cargar() {
        cargaActiva?.cancel()
        cargaActiva =
            viewModelScope.launch {
                _estado.value = EstadoMapa.Cargando
                val resultado = puntosRepository.obtenerPuntos(comuna = COMUNA_PILOTO)
                _estado.value =
                    when {
                        // TC-07: falla de consulta → error con reintento.
                        resultado.isFailure -> EstadoMapa.Error
                        // TC-06: consulta exitosa sin resultados → sin puntos disponibles.
                        resultado.getOrNull().isNullOrEmpty() -> EstadoMapa.SinPuntos
                        else -> EstadoMapa.Listo(resultado.getOrThrow())
                    }
            }
    }

    private companion object {
        /** RB-1: la capa pública se consulta para la zona piloto. */
        const val COMUNA_PILOTO = "Concepción"
    }
}
