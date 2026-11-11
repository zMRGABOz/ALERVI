package cl.alervi.domain.model

/**
 * Telemetría instantánea del dispositivo (RF-8).
 *
 * Respaldo: openapi.yaml `AlertCheckRequest` (session_id, latitude,
 * longitude, speed_mps, heading_degrees, accuracy_m, timestamp).
 *
 * RNF-S-8 (E1 §4.3): la posición se usa SOLO para calcular la alerta.
 * Nunca se almacena ni se escribe en registros. El [toString] está
 * sobrescrito para excluir las coordenadas y evitar fugas por Logcat.
 */
data class Telemetria(
    /** Identificador de la sesión de conducción (RB-14, `session_id`). */
    val idSesion: String,
    val latitud: Double,
    val longitud: Double,
    /** Velocidad instantánea en m/s (RB-13: mínimo 1,38 m/s). */
    val velocidadMps: Double,
    /** Rumbo azimut en grados (0 = Norte, 90 = Este); null si no disponible. */
    val rumboGrados: Double?,
    /** Precisión horizontal GPS en metros (RB-13: máximo 30 m). */
    val precisionM: Double?,
    /** Marca de tiempo de la captura GPS en epoch-ms (RB-13: antigüedad ≤ 5 s). */
    val timestampMs: Long,
) {
    /** RNF-S-8: sin coordenadas en la representación textual. */
    override fun toString(): String =
        "Telemetria(idSesion=$idSesion, velocidadMps=$velocidadMps, " +
            "rumboGrados=$rumboGrados, precisionM=$precisionM, timestampMs=$timestampMs)"
}
