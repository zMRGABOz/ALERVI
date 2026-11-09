package cl.alervi.data.repository.remote

import cl.alervi.data.api.AlertasApi
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.data.mapper.Mapeadores
import cl.alervi.data.repository.AlertasRepository
import cl.alervi.domain.model.AlertCheckConstants
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Implementación remota (flavor `local`) de la evaluación de alertas (RF-8).
 *
 * RNF-S-8: la posición viaja SOLO en el body de `POST /api/v1/alerts`
 * (jamás en URL; sin logging de red).
 *
 * R-8 (E1 §12): si el backend no responde en 3 s (o falla la llamada), se
 * calcula el TTC localmente con [EvaluarProximidadUseCase] sobre la caché
 * de puntos públicos; el resultado se marca `calculadaEnCliente = true`
 * para poder informarlo al usuario.
 */
@Singleton
class RemoteAlertasRepository
    @Inject
    constructor(
        private val api: AlertasApi,
        private val cache: CachePuntosPublicos,
        private val useCase: EvaluarProximidadUseCase,
    ) : AlertasRepository {
        override suspend fun evaluar(
            telemetria: Telemetria,
            puntosYaAdvertidos: Set<Int>,
            ahoraMs: Long,
        ): EvaluacionAlerta =
            withContext(Dispatchers.IO) {
                val remota =
                    withTimeoutOrNull(AlertCheckConstants.TIMEOUT_ALERTAS_MS) {
                        runCatching { Mapeadores.aEvaluacion(api.evaluar(Mapeadores.aAlertCheckRequest(telemetria))) }
                    }
                when {
                    remota != null && remota.isSuccess -> remota.getOrThrow()
                    else -> evaluarLocalmente(telemetria, puntosYaAdvertidos, ahoraMs)
                }
            }

        private suspend fun evaluarLocalmente(
            telemetria: Telemetria,
            puntosYaAdvertidos: Set<Int>,
            ahoraMs: Long,
        ): EvaluacionAlerta =
            useCase.evaluar(
                telemetria = telemetria,
                puntos = cache.cargar(),
                puntosYaAdvertidos = puntosYaAdvertidos,
                ahoraMs = ahoraMs,
            )
    }
