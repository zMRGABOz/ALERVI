package cl.alervi.data.mapper

import cl.alervi.data.api.dto.AlertCheckResponseDto
import cl.alervi.data.api.dto.AlertDetailDto
import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.api.dto.PuntoCriticoPropertiesDto
import cl.alervi.data.api.dto.PuntoCriticoPublicDetailDto
import cl.alervi.data.api.dto.AlertCheckRequestDto
import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.OrigenDetalle
import cl.alervi.domain.model.PatronSonoro
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.domain.model.Telemetria
import java.time.Instant

/**
 * Traducción DTO (contrato openapi.yaml) ↔ modelo de dominio.
 * RD-06: las coordenadas GeoJSON llegan como [longitud, latitud]; el dominio
 * las conserva en ese orden semántico (longitud primero).
 */
object Mapeadores {

    /**
     * Advertencia legal RB-6 usada al construir el detalle por respaldo
     * (texto del ejemplo de `PuntoCriticoPublicDetail.advertencia_legal`
     * en openapi.yaml).
     */
    const val ADVERTENCIA_LEGAL_RB6: String =
        "El índice expresa prioridad de intervención relativa. La ausencia de avisos no " +
            "garantiza que la vía esté libre de peligro. Conduzca con precaución."

    /** GeoJSON → lista de puntos críticos. Descarta features con geometría inválida. */
    fun aPuntos(fc: GeoJsonFeatureCollectionDto): List<PuntoCritico> =
        fc.features.mapNotNull { feature ->
            val coords = feature.geometry.coordinates
            // RFC 7946 / RD-06: exactamente [longitud, latitud].
            if (feature.geometry.type != "Point" || coords.size != 2) return@mapNotNull null
            aPunto(feature.properties, coords[0], coords[1])
        }

    /** `PuntoCriticoProperties` → dominio. Nivel inválido → null (no se inventa). */
    fun aPunto(
        props: PuntoCriticoPropertiesDto,
        longitud: Double,
        latitud: Double,
    ): PuntoCritico? {
        val nivel = NivelRiesgo.desdeValor(props.nivelRiesgo) ?: return null
        return PuntoCritico(
            idPunto = props.idPunto,
            longitud = longitud,
            latitud = latitud,
            nombreInterseccion = props.nombreInterseccion,
            comuna = props.comuna,
            nivelRiesgo = nivel,
            indicePrioridad = props.indicePrioridad,
            totalSiniestros = props.totalSiniestros,
            totalFallecidos = props.totalFallecidos,
            totalGraves = props.totalGraves,
            tendencia = props.tendencia,
            resumenPublico = props.resumenPublico,
        )
    }

    /** `PuntoCriticoPublicDetail` → dominio (origen API). */
    fun aDetalle(dto: PuntoCriticoPublicDetailDto): DetallePuntoCritico? {
        val nivel = NivelRiesgo.desdeValor(dto.nivelRiesgo) ?: return null
        return DetallePuntoCritico(
            idPunto = dto.idPunto,
            nombreInterseccion = dto.nombreInterseccion,
            comuna = dto.comuna,
            latitud = dto.latitud,
            longitud = dto.longitud,
            nivelRiesgo = nivel,
            indicePrioridad = dto.indicePrioridad,
            totalSiniestros = dto.totalSiniestros,
            totalFallecidos = dto.totalFallecidos,
            totalGraves = dto.totalGraves,
            totalLeves = dto.totalLeves,
            tendencia = dto.tendencia,
            periodoDatos = dto.periodoDatos,
            colegioCercanoM = dto.colegioCercanoM,
            paraderoCercanoM = dto.paraderoCercanoM,
            explicacionCiudadana = dto.explicacionCiudadana,
            advertenciaLegal = dto.advertenciaLegal,
            origen = OrigenDetalle.API,
        )
    }

    /**
     * Respaldo temporal (regla de integración incompleta): construye el
     * detalle desde las `properties` del punto ya recibidas en la lista
     * `GET /api/v1/publico/riesgo`, marcando origen RESPALDO_LISTA.
     * Los campos que la lista no trae quedan como «no disponible» (null),
     * sin inventar períodos ni métricas (RB-2).
     */
    fun aDetalleRespaldo(punto: PuntoCritico): DetallePuntoCritico =
        DetallePuntoCritico(
            idPunto = punto.idPunto,
            nombreInterseccion = punto.nombreInterseccion,
            comuna = punto.comuna,
            latitud = punto.latitud,
            longitud = punto.longitud,
            nivelRiesgo = punto.nivelRiesgo,
            indicePrioridad = punto.indicePrioridad,
            totalSiniestros = punto.totalSiniestros,
            totalFallecidos = punto.totalFallecidos,
            totalGraves = punto.totalGraves,
            totalLeves = null,
            tendencia = punto.tendencia,
            periodoDatos = null,
            colegioCercanoM = null,
            paraderoCercanoM = null,
            explicacionCiudadana = punto.resumenPublico,
            advertenciaLegal = ADVERTENCIA_LEGAL_RB6,
            origen = OrigenDetalle.RESPALDO_LISTA,
        )

    /** Telemetría de dominio → `AlertCheckRequest` (coordenadas solo en el body, RNF-S-8). */
    fun aAlertCheckRequest(t: Telemetria): AlertCheckRequestDto =
        AlertCheckRequestDto(
            sessionId = t.idSesion,
            latitude = t.latitud,
            longitude = t.longitud,
            speedMps = t.velocidadMps,
            headingDegrees = t.rumboGrados,
            accuracyM = t.precisionM,
            timestamp = Instant.ofEpochMilli(t.timestampMs).toString(), // ISO 8601
        )

    /** `AlertCheckResponse` → dominio. */
    fun aEvaluacion(dto: AlertCheckResponseDto): EvaluacionAlerta =
        if (dto.alertaActiva && dto.alerta != null) {
            EvaluacionAlerta.ConAlerta(
                alerta = aAlerta(dto.alerta),
                calculadaEnCliente = false,
            )
        } else {
            EvaluacionAlerta.Suprimida(
                // Estado desconocido fuera del enum del contrato: se suprime
                // de forma conservadora (nunca se emite una alerta sin motivo válido).
                motivo = MotivoSupresion.desdeValor(dto.telemetriaStatus)
                    ?: MotivoSupresion.SIN_PUNTOS_EN_RANGO,
            )
        }

    private fun aAlerta(dto: AlertDetailDto): AlertaProximidad {
        // Fallbacks de representación ante valores fuera del enum del contrato;
        // la emisión de la alerta no depende de ellos.
        val nivel = NivelRiesgo.desdeValor(dto.nivelRiesgo) ?: NivelRiesgo.MEDIO
        val patron = PatronSonoro.desdeValor(dto.patronSonoro) ?: PatronSonoro.TONO_CORTO
        return AlertaProximidad(
            idPunto = dto.idPunto,
            nombreInterseccion = dto.nombreInterseccion,
            nivelRiesgo = nivel,
            distanciaM = dto.distanciaM,
            ttcSegundos = dto.ttcSegundos,
            mensajeVisual = dto.mensajeVisual,
            patronSonoro = patron,
            instruccionSeguridad = dto.instruccionSeguridad,
        )
    }
}
