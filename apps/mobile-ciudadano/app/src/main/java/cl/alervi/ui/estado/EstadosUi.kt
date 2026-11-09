package cl.alervi.ui.estado

import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.PuntoCritico

/**
 * Estados inmutables que consumen las pantallas.
 *
 * Las pantallas son puras: reciben estos estados y devuelven acciones por
 * callback. La distinción entre «sin puntos» y «falla de consulta» es
 * obligatoria (TC-06 vs TC-07, E1 §11.2; RF-2 flujos alternos).
 */

/** Capa pública de puntos críticos (RF-2). */
sealed interface EstadoMapa {
    data object Cargando : EstadoMapa

    /** Consulta exitosa con al menos un punto. */
    data class Listo(val puntos: List<PuntoCritico>) : EstadoMapa

    /** Consulta exitosa sin resultados: no se afirma que la zona carezca de riesgo. */
    data object SinPuntos : EstadoMapa

    /** Falla de consulta: se ofrece reintentar. */
    data object Error : EstadoMapa
}

/** Detalle público extendido de un punto (RF-2). */
sealed interface EstadoDetalle {
    data object Cargando : EstadoDetalle

    data class Listo(val detalle: DetallePuntoCritico) : EstadoDetalle

    data object Error : EstadoDetalle
}

/**
 * Estado del permiso de ubicación (TC-27: informar la limitación).
 * NO_SOLICITADO permite explicar antes de pedir el permiso del sistema (§5.3).
 */
enum class EstadoPermisoUbicacion {
    NO_SOLICITADO,
    CONCEDIDO,
    DENEGADO,
}

/**
 * Estado de monitoreo mostrado en el mapa (RB-14, TC-27).
 *
 * [SIN_PERMISO] evita afirmar que hay monitoreo cuando el consentimiento
 * existe pero el sistema no concedió la ubicación.
 */
enum class EstadoMonitoreo {
    ACTIVO,
    SIN_PERMISO,
    INACTIVO,
}

/** Estado de la pantalla de configuración (pantalla 06). */
data class EstadoConfiguracion(
    val permiso: EstadoPermisoUbicacion,
    /** Sesión de alertas vigente (RB-14). */
    val alertasActivas: Boolean,
    /** Registro local de consentimiento (versión + fecha, §5.3) o null si no se otorgó. */
    val consentimiento: RegistroConsentimiento.Consentimiento?,
)

/** Pestaña activa de la barra inferior (Mapa / Ajustes). */
enum class PestanaAlervi {
    MAPA,
    AJUSTES,
}
