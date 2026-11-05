package cl.alervi.domain.model

/**
 * Resultado de la evaluación cinemática de una telemetría contra los puntos
 * críticos (RF-8, RB-13, RB-14).
 *
 * Respaldo: openapi.yaml `AlertCheckResponse` (alerta_activa,
 * telemetria_status, alerta).
 */
sealed interface EvaluacionAlerta {

    /** Debe emitirse la alerta sonora y visual (RF-8). */
    data class ConAlerta(
        val alerta: AlertaProximidad,
        /**
         * True cuando la evaluación se calculó en el cliente (fallback local
         * por timeout > 3 s del backend, R-8, o flavor mock), en lugar de
         * provenir de `POST /api/v1/alerts`.
         */
        val calculadaEnCliente: Boolean,
    ) : EvaluacionAlerta

    /** No se emite alerta; el motivo respeta el enum del contrato. */
    data class Suprimida(val motivo: MotivoSupresion) : EvaluacionAlerta
}

/**
 * Motivos de supresión. Valores EXACTOS del enum `telemetria_status` de
 * `AlertCheckResponse` en openapi.yaml.
 */
enum class MotivoSupresion(val valorContrato: String) {
    SUPRIMIDO_VELOCIDAD_BAJA("SUPRIMIDO_VELOCIDAD_BAJA"),
    SUPRIMIDO_TRAYECTORIA_DIVERGENTE("SUPRIMIDO_TRAYECTORIA_DIVERGENTE"),
    SUPRIMIDO_TTC_MAYOR_12S("SUPRIMIDO_TTC_MAYOR_12S"),
    SUPRIMIDO_PUNTO_YA_ADVERTIDO("SUPRIMIDO_PUNTO_YA_ADVERTIDO"),
    BAJA_PRECISION_GPS("BAJA_PRECISION_GPS"),
    TELEMETRIA_OBSOLETA("TELEMETRIA_OBSOLETA"),
    SIN_PUNTOS_EN_RANGO("SIN_PUNTOS_EN_RANGO"),
    ;

    companion object {
        /** Mapea el valor crudo del contrato; null si es desconocido. */
        fun desdeValor(raw: String?): MotivoSupresion? =
            entries.firstOrNull { it.valorContrato == raw }
    }
}

/**
 * Aviso de proximidad a emitir (sonoro y visual, sin interacción: RD-04, RNF-U-4).
 *
 * Respaldo: openapi.yaml `AlertDetail` (id_punto, nombre_interseccion,
 * nivel_riesgo, distancia_m, ttc_segundos, mensaje_visual, patron_sonoro,
 * instruccion_seguridad).
 */
data class AlertaProximidad(
    val idPunto: Int,
    val nombreInterseccion: String,
    val nivelRiesgo: NivelRiesgo,
    /** Distancia en metros hacia el punto (cálculo en UTM 18S, RD-06/RNF-C-4). */
    val distanciaM: Double,
    /** Tiempo estimado de arribo en segundos (siempre ≤ 12 s, RB-13). */
    val ttcSegundos: Double,
    /** Texto breve legible a un golpe de vista (RNF-U-4). */
    val mensajeVisual: String,
    /** Tipo de aviso sonoro (`patron_sonoro` en openapi.yaml). */
    val patronSonoro: PatronSonoro,
    val instruccionSeguridad: String? = null,
)

/**
 * Patrones sonoros del contrato `AlertDetail.patron_sonoro`.
 */
enum class PatronSonoro(val valorContrato: String) {
    BEEP_URGENTE("BEEP_URGENTE"),
    BEEP_PRECAUCION("BEEP_PRECAUCION"),
    TONO_CORTO("TONO_CORTO"),
    ;

    companion object {
        fun desdeValor(raw: String?): PatronSonoro? =
            entries.firstOrNull { it.valorContrato == raw }
    }
}
