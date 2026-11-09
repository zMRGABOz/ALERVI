package cl.alervi.domain.sesion

import cl.alervi.domain.model.SesionAlertas
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Dueño ÚNICO de la sesión de alertas (RB-14) compartido por la interfaz y el
 * [cl.alervi.location.ServicioAlertasProximidad].
 *
 * Motivo: el registro de puntos ya advertidos debe sobrevivir a la pantalla
 * bloqueada, a la pérdida temporal de GPS/red y al paso de la app a segundo
 * plano. Si viviera en el ViewModel, la evaluación en marcha lo perdería.
 *
 * La sesión NO contiene coordenadas (RNF-S-8): solo el identificador de sesión
 * y los `id_punto` ya advertidos. Nada de esto se persiste en disco.
 */
@Singleton
class GestorSesionAlertas
    @Inject
    constructor() {

        private val bloqueo = Any()

        private val _sesion = MutableStateFlow<SesionAlertas?>(null)

        /** Sesión vigente (null si las alertas están desactivadas). */
        val sesion: StateFlow<SesionAlertas?> = _sesion.asStateFlow()

        /**
         * Abre la sesión si no existe (acción afirmativa del usuario). Si ya
         * hay una vigente NO la reinicia: RB-14 exige conservar los puntos
         * advertidos hasta que el usuario desactive las alertas.
         */
        fun activar(): SesionAlertas =
            synchronized(bloqueo) {
                _sesion.value ?: SesionAlertas().also { _sesion.value = it }
            }

        /** Cierra la sesión (retiro del consentimiento, RB-14). */
        fun desactivar() {
            synchronized(bloqueo) {
                _sesion.value = null
            }
        }

        /** Identificador `session_id` del contrato, o null sin sesión. */
        fun idSesion(): String? = synchronized(bloqueo) { _sesion.value?.idSesion }

        /** Copia inmutable de los puntos ya advertidos en la sesión. */
        fun advertidos(): Set<Int> = synchronized(bloqueo) { _sesion.value?.puntosAdvertidos ?: emptySet() }

        /**
         * Marca un punto como advertido de forma atómica.
         *
         * @return true si el punto NO estaba advertido y queda registrado;
         *         false si ya estaba advertido o no hay sesión.
         */
        fun registrarAdvertido(idPunto: Int): Boolean =
            synchronized(bloqueo) {
                val actual = _sesion.value ?: return false
                if (actual.yaAdvertido(idPunto)) {
                    false
                } else {
                    actual.registrarAdvertido(idPunto)
                    true
                }
            }
    }
