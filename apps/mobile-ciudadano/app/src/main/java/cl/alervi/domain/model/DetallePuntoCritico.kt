package cl.alervi.domain.model

/**
 * Detalle público extendido de un punto crítico (RF-2).
 *
 * Respaldo: openapi.yaml `PuntoCriticoPublicDetail` (endpoint
 * `GET /api/v1/publico/riesgo/{id_punto}`), que incluye la advertencia
 * legal de interpretación relativa (RB-6).
 *
 * Origen del dato: el backend de `develop` aún no expone el endpoint de
 * detalle; cuando responde 404 (o en flavor mock) se construye a partir de
 * las `properties` ya recibidas en `GET /api/v1/publico/riesgo`, marcando
 * el origen para informarlo al usuario (regla de integración incompleta).
 */
data class DetallePuntoCritico(
    val idPunto: Int,
    val nombreInterseccion: String,
    val comuna: String,
    val latitud: Double,
    val longitud: Double,
    val nivelRiesgo: NivelRiesgo,
    val indicePrioridad: Double,
    val totalSiniestros: Int,
    val totalFallecidos: Int? = null,
    val totalGraves: Int? = null,
    val totalLeves: Int? = null,
    val tendencia: String? = null,
    /** Período de los antecedentes (RB-2: procedencia y período). */
    val periodoDatos: String? = null,
    val colegioCercanoM: Int? = null,
    val paraderoCercanoM: Int? = null,
    val explicacionCiudadana: String? = null,
    /** Advertencia legal de interpretación relativa (RB-6, RNF-U-5). */
    val advertenciaLegal: String,
    /** De dónde proviene el detalle mostrado. */
    val origen: OrigenDetalle = OrigenDetalle.API,
)

/**
 * Procedencia del detalle: endpoint de detalle (API), respaldo temporal con
 * las `properties` de la lista (RESPALDO_LISTA, informado al usuario) o
 * fixture simulada del flavor mock (SIMULADO).
 */
enum class OrigenDetalle {
    API,
    RESPALDO_LISTA,
    SIMULADO,
}
