package cl.alervi.ui.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.ui.estado.EstadoDetalle
import cl.alervi.ui.navigation.Rutas
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel del detalle público extendido de un punto crítico (RF-2).
 *
 * La ruta es `detalle/{idPunto}` ([Rutas.DETALLE]); el identificador llega por
 * [SavedStateHandle]. Si falta o no es un entero válido, se muestra Error en
 * lugar de interpretarlo como ausencia de riesgo (RB-2).
 */
@HiltViewModel
class DetalleViewModel
@Inject
constructor(
    private val puntosRepository: PuntosRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /**
     * El argumento de la ruta `detalle/{idPunto}` puede llegar como String o
     * como Int según la declaración de la navegación; se aceptan ambos casos
     * y se descarta lo inválido.
     */
    private val idPunto: Int? =
        when (val crudo = savedStateHandle.get<Any>(Rutas.ARG_ID_PUNTO)) {
            is Number -> crudo.toInt()
            is String -> crudo.toIntOrNull()
            else -> null
        }

    private val _estado = MutableStateFlow<EstadoDetalle>(EstadoDetalle.Cargando)

    /** Estado que consume la pantalla pura del detalle (pantalla 04). */
    val estado: StateFlow<EstadoDetalle> = _estado.asStateFlow()

    private var cargaActiva: Job? = null

    init {
        cargar()
    }

    /** Recarga el detalle (también usado por el botón «reintentar»). */
    fun cargar() {
        val id = idPunto
        if (id == null) {
            _estado.value = EstadoDetalle.Error
            return
        }
        cargaActiva?.cancel()
        cargaActiva =
            viewModelScope.launch {
                _estado.value = EstadoDetalle.Cargando
                val resultado = puntosRepository.obtenerDetalle(id)
                _estado.value =
                    if (resultado.isSuccess) EstadoDetalle.Listo(resultado.getOrThrow()) else EstadoDetalle.Error
            }
    }
}
