package cl.alervi.domain.model

/**
 * Punto crítico vial público (RF-2, E1 §3.2).
 *
 * Respaldo: openapi.yaml `GeoJsonFeature` + `PuntoCriticoProperties`
 * (coordenadas GeoJSON [longitud, latitud] WGS 84, RFC 7946 / RD-06).
 *
 * RB-1 (E1 §6): solo puntos de la comuna de Concepción (zona piloto).
 * RB-6 (E1 §6): el índice expresa prioridad relativa, no probabilidad
 * individual de siniestro ni certificación de seguridad de la vía.
 */
data class PuntoCritico(
    val idPunto: Int,
    /** Longitud WGS 84 (orden GeoJSON: longitud primero, RD-06). */
    val longitud: Double,
    /** Latitud WGS 84. */
    val latitud: Double,
    val nombreInterseccion: String,
    val comuna: String,
    val nivelRiesgo: NivelRiesgo,
    /** Índice de prioridad ∈ [0, 100] (RB-5/RB-6). */
    val indicePrioridad: Double,
    val totalSiniestros: Int,
    val totalFallecidos: Int? = null,
    val totalGraves: Int? = null,
    /** Tendencia: ALZA / ESTABLE / BAJA (openapi `tendencia`). */
    val tendencia: String? = null,
    val resumenPublico: String? = null,
)

/**
 * Tendencia interanual de siniestros de un punto (openapi `tendencia`).
 */
enum class Tendencia(val valorContrato: String) {
    ALZA("ALZA"),
    ESTABLE("ESTABLE"),
    BAJA("BAJA"),
    ;

    companion object {
        fun desdeValor(raw: String?): Tendencia? = entries.firstOrNull { it.valorContrato == raw }
    }
}
