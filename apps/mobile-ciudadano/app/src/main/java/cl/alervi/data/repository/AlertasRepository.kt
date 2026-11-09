package cl.alervi.data.repository

import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.Telemetria

/**
 * Repositorio de evaluación de alertas de proximidad (RF-8).
 *
 * Implementaciones inyectadas con Hilt según flavor:
 *  - `mock` : cálculo 100 % local con [cl.alervi.domain.usecase.EvaluarProximidadUseCase]
 *             sobre los fixtures.
 *  - `local`: `POST /api/v1/alerts` (coordenadas solo en el body, RNF-S-8);
 *             si no responde en 3 s (R-8) o falla la red, calcula localmente
 *             con la caché de puntos públicos.
 */
interface AlertasRepository {
    /**
     * Evalúa la telemetría vigente contra los puntos conocidos.
     *
     * @param puntosYaAdvertidos ids advertidos en la sesión (RB-14).
     * @param ahoraMs reloj de referencia (antigüedad ≤ 5 s, RB-13).
     */
    suspend fun evaluar(
        telemetria: Telemetria,
        puntosYaAdvertidos: Set<Int>,
        ahoraMs: Long = System.currentTimeMillis(),
    ): EvaluacionAlerta
}
