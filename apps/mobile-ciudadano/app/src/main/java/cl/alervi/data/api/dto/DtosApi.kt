package cl.alervi.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * DTOs del contrato ÚNICO: alervi/packages/shared-contracts/openapi.yaml.
 * Cubre los 11 esquemas móviles: HealthResponse, GeoJsonFeatureCollection,
 * GeoJsonFeature, GeoJsonPoint, PuntoCriticoProperties,
 * PuntoCriticoPublicDetail, AlertCheckRequest, AlertCheckResponse,
 * AlertDetail, ErrorResponse, ValidationErrorResponse.
 *
 * Reglas:
 *  - Nombres JSON exactos del contrato vía @SerialName (RNF-C-3).
 *  - Campos opcionales/nullable del contrato → nullable con default null.
 */

// ---------------------------------------------------------------------------
// 1) HealthResponse
// ---------------------------------------------------------------------------
@Serializable
data class HealthResponseDto(
    val status: String,
    val service: String,
    val version: String,
)

// ---------------------------------------------------------------------------
// 2–4) GeoJSON (RFC 7946: coordinates = [longitud, latitud], RD-06)
// ---------------------------------------------------------------------------
@Serializable
data class GeoJsonFeatureCollectionDto(
    val type: String, // "FeatureCollection"
    val features: List<GeoJsonFeatureDto> = emptyList(),
)

@Serializable
data class GeoJsonFeatureDto(
    val type: String, // "Feature"
    val id: Int,
    val geometry: GeoJsonPointDto,
    val properties: PuntoCriticoPropertiesDto,
)

@Serializable
data class GeoJsonPointDto(
    val type: String, // "Point"
    val coordinates: List<Double>, // [longitud, latitud] WGS 84
)

// ---------------------------------------------------------------------------
// 5) PuntoCriticoProperties
// ---------------------------------------------------------------------------
@Serializable
data class PuntoCriticoPropertiesDto(
    @SerialName("id_punto") val idPunto: Int,
    @SerialName("nombre_interseccion") val nombreInterseccion: String,
    val comuna: String,
    @SerialName("nivel_riesgo") val nivelRiesgo: String,
    @SerialName("indice_prioridad") val indicePrioridad: Double,
    @SerialName("total_siniestros") val totalSiniestros: Int,
    @SerialName("total_fallecidos") val totalFallecidos: Int? = null,
    @SerialName("total_graves") val totalGraves: Int? = null,
    val tendencia: String? = null,
    @SerialName("resumen_publico") val resumenPublico: String? = null,
)

// ---------------------------------------------------------------------------
// 6) PuntoCriticoPublicDetail
// ---------------------------------------------------------------------------
@Serializable
data class PuntoCriticoPublicDetailDto(
    @SerialName("id_punto") val idPunto: Int,
    @SerialName("nombre_interseccion") val nombreInterseccion: String,
    val comuna: String,
    val latitud: Double,
    val longitud: Double,
    @SerialName("nivel_riesgo") val nivelRiesgo: String,
    @SerialName("indice_prioridad") val indicePrioridad: Double,
    @SerialName("total_siniestros") val totalSiniestros: Int,
    @SerialName("total_fallecidos") val totalFallecidos: Int? = null,
    @SerialName("total_graves") val totalGraves: Int? = null,
    @SerialName("total_leves") val totalLeves: Int? = null,
    val tendencia: String? = null,
    @SerialName("periodo_datos") val periodoDatos: String? = null,
    @SerialName("colegio_cercano_m") val colegioCercanoM: Int? = null,
    @SerialName("paradero_cercano_m") val paraderoCercanoM: Int? = null,
    @SerialName("explicacion_ciudadana") val explicacionCiudadana: String? = null,
    @SerialName("advertencia_legal") val advertenciaLegal: String,
)

// ---------------------------------------------------------------------------
// 7) AlertCheckRequest
// ---------------------------------------------------------------------------
@Serializable
data class AlertCheckRequestDto(
    @SerialName("session_id") val sessionId: String,
    val latitude: Double,
    val longitude: Double,
    @SerialName("speed_mps") val speedMps: Double,
    @SerialName("heading_degrees") val headingDegrees: Double? = null,
    @SerialName("accuracy_m") val accuracyM: Double? = null,
    /** ISO 8601 (formato date-time del contrato). */
    val timestamp: String,
)

// ---------------------------------------------------------------------------
// 8) AlertCheckResponse
// ---------------------------------------------------------------------------
@Serializable
data class AlertCheckResponseDto(
    @SerialName("alerta_activa") val alertaActiva: Boolean,
    @SerialName("telemetria_status") val telemetriaStatus: String,
    val alerta: AlertDetailDto? = null,
)

// ---------------------------------------------------------------------------
// 9) AlertDetail
// ---------------------------------------------------------------------------
@Serializable
data class AlertDetailDto(
    @SerialName("id_punto") val idPunto: Int,
    @SerialName("nombre_interseccion") val nombreInterseccion: String,
    @SerialName("nivel_riesgo") val nivelRiesgo: String,
    @SerialName("distancia_m") val distanciaM: Double,
    @SerialName("ttc_segundos") val ttcSegundos: Double,
    @SerialName("mensaje_visual") val mensajeVisual: String,
    @SerialName("patron_sonoro") val patronSonoro: String,
    @SerialName("instruccion_seguridad") val instruccionSeguridad: String? = null,
)

// ---------------------------------------------------------------------------
// 10) ErrorResponse
// ---------------------------------------------------------------------------
@Serializable
data class ErrorResponseDto(
    val codigo: String,
    val mensaje: String,
    val detalle: String? = null,
)

// ---------------------------------------------------------------------------
// 11) ValidationErrorResponse
// ---------------------------------------------------------------------------
@Serializable
data class ValidationErrorResponseDto(
    val detail: List<ValidationErrorItemDto> = emptyList(),
)

@Serializable
data class ValidationErrorItemDto(
    val loc: List<String> = emptyList(),
    val msg: String = "",
    val type: String = "",
)
