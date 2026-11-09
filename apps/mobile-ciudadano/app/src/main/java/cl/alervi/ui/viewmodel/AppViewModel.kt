package cl.alervi.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.SesionAlertas
import cl.alervi.domain.sesion.GestorSesionAlertas
import cl.alervi.location.BusAvisos
import cl.alervi.location.ServicioAlertasProximidad
import cl.alervi.location.VerificadorPermisoUbicacion
import cl.alervi.ui.estado.EstadoPermisoUbicacion
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel de aplicación.
 *
 * Responsabilidades:
 *  - Observar el registro local de consentimiento (§5.3: versión del texto
 *    aceptado + fecha; el servidor NO guarda identidad, R-5).
 *  - Sincronizar la sesión de alertas con [GestorSesionAlertas], dueño único
 *    compartido con el servicio en primer plano (RB-14).
 *  - Arrancar/detener [ServicioAlertasProximidad] según consentimiento y
 *    permiso de ubicación (TC-27).
 *  - Exponer la alerta vigente publicada por el servicio ([BusAvisos]).
 *
 * Privacidad (RNF-S-8): este ViewModel NO escribe coordenadas ni registra
 * eventos en Logcat; solamente maneja versión/fecha del consentimiento.
 */
@HiltViewModel
class AppViewModel
    @Inject
    constructor(
        private val registroConsentimiento: RegistroConsentimiento,
        private val gestorSesion: GestorSesionAlertas,
        private val busAvisos: BusAvisos,
        private val verificadorPermiso: VerificadorPermisoUbicacion,
        @ApplicationContext private val contexto: Context,
    ) : ViewModel() {

        private val _consentimiento = MutableStateFlow<RegistroConsentimiento.Consentimiento?>(null)

        /** Registro local de consentimiento observado (null si nunca se aceptó). */
        val consentimiento: StateFlow<RegistroConsentimiento.Consentimiento?> =
            _consentimiento.asStateFlow()

        /** Sesión de alertas vigente; true mientras exista consentimiento registrado. */
        val alertasActivas: StateFlow<Boolean> =
            _consentimiento
                .map { registro -> registro != null }
                .stateIn(
                    scope = viewModelScope,
                    started = SharingStarted.WhileSubscribed(5_000),
                    initialValue = false,
                )

        private val _consentimientoCargado = MutableStateFlow(false)

        /** True tras la primera emisión del flujo de DataStore (lectura inicial concluida). */
        val consentimientoCargado: StateFlow<Boolean> = _consentimientoCargado.asStateFlow()

        private val _permisoUbicacion =
            MutableStateFlow<EstadoPermisoUbicacion>(EstadoPermisoUbicacion.NO_SOLICITADO)

        /** Estado del permiso de ubicación informado a la configuración (pantalla 06). */
        val permisoUbicacion: StateFlow<EstadoPermisoUbicacion> = _permisoUbicacion.asStateFlow()

        /** Sesión de alertas vigente (RB-14) o null si no hay monitoreo activo. */
        val sesion: StateFlow<SesionAlertas?> = gestorSesion.sesion

        /** Alerta visual vigente mostrada sobre la navegación (RD-04). */
        val alertaActual: StateFlow<AlertaProximidad?> = busAvisos.alerta

        init {
            // El arranque sincroniza sesión RB-14 con el consentimiento registrado:
            // si existe consentimiento al iniciar la app, hay sesión vigente y el
            // servicio se inicia cuando el permiso ya está concedido.
            // El orden importa para la navegación: primero se publica el dato y
            // después el flag de «cargado», para que AlerviRoot decida el
            // startDestination con el consentimiento YA vigente (§5.3).
            viewModelScope.launch {
                registroConsentimiento.flujo.collect { registro ->
                    _consentimiento.value = registro // 1º el dato
                    _consentimientoCargado.value = true // 2º el flag
                    if (registro == null) {
                        // Retiro del consentimiento: fin de sesión y del servicio
                        // (RB-14, §5.3).
                        gestorSesion.desactivar()
                        busAvisos.limpiar()
                        ServicioAlertasProximidad.detener(contexto)
                    } else {
                        gestorSesion.activar()
                        if (_permisoUbicacion.value == EstadoPermisoUbicacion.CONCEDIDO) {
                            ServicioAlertasProximidad.iniciar(contexto)
                        }
                    }
                }
            }
        }

        /**
         * Acción afirmativa de consentimiento (§5.3): registra la versión del texto
         * aceptado y la fecha de aceptación en el dispositivo, y abre una nueva
         * sesión de alertas (RB-14).
         */
        fun activarAlertas() {
            viewModelScope.launch {
                registroConsentimiento.registrar(
                    RegistroConsentimiento.VERSION_TEXTO_ACTUAL,
                    System.currentTimeMillis(),
                )
                gestorSesion.activar()
                // Si el permiso ya estaba concedido no habrá diálogo del sistema:
                // el servicio debe arrancar de inmediato.
                if (verificadorPermiso.concedido()) {
                    _permisoUbicacion.value = EstadoPermisoUbicacion.CONCEDIDO
                    ServicioAlertasProximidad.iniciar(contexto)
                }
            }
        }

        /** Retiro del consentimiento (§5.3): borra el registro local y cierra la sesión (RB-14). */
        fun desactivarAlertas() {
            viewModelScope.launch {
                registroConsentimiento.retirar()
                gestorSesion.desactivar()
                busAvisos.limpiar()
                ServicioAlertasProximidad.detener(contexto)
            }
        }

        /**
         * Sincroniza el estado del permiso al abrir o retomar la app (TC-27) con
         * el valor real del sistema. No se vuelve a pedir solo.
         */
        fun sincronizarPermiso() {
            inicializarPermiso(verificadorPermiso.concedido())
        }

        /**
         * Estado real del permiso (TC-27): CONCEDIDO si el sistema ya lo otorgó;
         * si no, se informa DENEGADO y se detiene el monitoreo.
         */
        fun inicializarPermiso(concedido: Boolean) {
            _permisoUbicacion.value =
                when {
                    concedido -> EstadoPermisoUbicacion.CONCEDIDO
                    // Con consentimiento registrado, la falta de permiso es una
                    // limitación DENEGADA, no un estado «no solicitado» (TC-27):
                    // la app debe informar que no puede emitir alertas.
                    _consentimiento.value != null ||
                        _permisoUbicacion.value != EstadoPermisoUbicacion.NO_SOLICITADO ->
                        EstadoPermisoUbicacion.DENEGADO
                    else -> EstadoPermisoUbicacion.NO_SOLICITADO
                }
            if (concedido) {
                if (gestorSesion.idSesion() != null) ServicioAlertasProximidad.iniciar(contexto)
            } else {
                ServicioAlertasProximidad.detener(contexto)
            }
        }

        /** Resultado del diálogo del sistema: CONCEDIDO / DENEGADO. */
        fun actualizarPermiso(concedido: Boolean) {
            _permisoUbicacion.value =
                if (concedido) EstadoPermisoUbicacion.CONCEDIDO else EstadoPermisoUbicacion.DENEGADO
            if (concedido) {
                if (gestorSesion.idSesion() != null) ServicioAlertasProximidad.iniciar(contexto)
            } else {
                ServicioAlertasProximidad.detener(contexto)
            }
        }

        /** El conductor vuelve al mapa desde la alerta visual; la oculta. */
        fun descartarAlerta() {
            busAvisos.limpiar()
        }

    }
