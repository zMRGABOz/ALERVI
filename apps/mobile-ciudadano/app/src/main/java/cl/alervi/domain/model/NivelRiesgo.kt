package cl.alervi.domain.model

/**
 * Nivel de riesgo público de un punto crítico.
 *
 * Respaldo: openapi.yaml `PuntoCriticoProperties.nivel_riesgo` y
 * `PuntoCriticoPublicDetail.nivel_riesgo` (enum CRITICO, ALTO, MEDIO, BAJO);
 * se muestra en el mapa y detalle públicos (RF-2, E1 §3.2).
 *
 * Interpretación (RB-6, E1 §6): expresa prioridad relativa; no es probabilidad
 * individual de siniestro ni certificación de seguridad de la vía.
 */
enum class NivelRiesgo {
    CRITICO,
    ALTO,
    MEDIO,
    BAJO,
    ;

    /** Etiqueta en español para la interfaz (RNF-U-3: 100 % español). */
    val etiqueta: String
        get() =
            when (this) {
                CRITICO -> "Crítico"
                ALTO -> "Alto"
                MEDIO -> "Medio"
                BAJO -> "Bajo"
            }

    companion object {
        /**
         * Mapea el valor crudo del contrato OpenAPI. Devuelve null si el valor
         * no pertenece al enum (dato incompleto: se informa como «no disponible»
         * en vez de interpretarlo como ausencia de riesgo, RF-2/RB-2).
         */
        fun desdeValor(raw: String?): NivelRiesgo? =
            raw?.let { valor ->
                entries.firstOrNull { it.name.equals(valor, ignoreCase = true) }
            }
    }
}
