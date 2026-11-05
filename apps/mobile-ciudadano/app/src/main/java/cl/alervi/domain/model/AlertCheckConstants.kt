package cl.alervi.domain.model

/**
 * Constantes cinemáticas de RB-13 (E1 §6) y del fallback local R-8 (E1 §12).
 * Valores del informe; NO modificables sin control de cambios (E1 §9.1).
 */
object AlertCheckConstants {
    /** RB-13: antigüedad máxima de la ubicación (5 s). */
    const val MAX_ANTIGUEDAD_MS: Long = 5_000L

    /** RB-13: precisión horizontal máxima (30 m). */
    const val MAX_PRECISION_M: Double = 30.0

    /** RB-13: velocidad instantánea mínima (1,38 m/s ≈ 5 km/h). */
    const val MIN_VELOCIDAD_MPS: Double = 1.38

    /** RB-13: tiempo estimado de arribo máximo (12 s). */
    const val MAX_TTC_S: Double = 12.0

    /** R-8: timeout del cliente para `POST /api/v1/alerts` (3 s) antes del cálculo local. */
    const val TIMEOUT_ALERTAS_MS: Long = 3_000L
}
