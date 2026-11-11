package cl.alervi.data.repository.mock

import cl.alervi.data.repository.AlertasRepository
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositorio de alertas del flavor `mock` (RD-01: sin red).
 *
 * Evalúa la telemetría con el MISMO caso de uso puro RB-13/RB-14 que usa el
 * fallback local R-8 del flavor `local`, sobre los puntos de los fixtures.
 */
@Singleton
class MockAlertasRepository
    @Inject
    constructor(
        private val puntos: MockPuntosRepository,
        private val useCase: EvaluarProximidadUseCase,
    ) : AlertasRepository {
        override suspend fun evaluar(
            telemetria: Telemetria,
            puntosYaAdvertidos: Set<Int>,
            ahoraMs: Long,
        ): EvaluacionAlerta {
            val candidatos = puntos.obtenerPuntos().getOrDefault(emptyList())
            return useCase.evaluar(telemetria, candidatos, puntosYaAdvertidos, ahoraMs)
        }
    }
