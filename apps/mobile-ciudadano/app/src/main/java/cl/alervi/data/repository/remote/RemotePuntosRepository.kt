package cl.alervi.data.repository.remote

import cl.alervi.data.api.PublicoApi
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.data.mapper.Mapeadores
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.PuntoCritico
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Implementación remota (flavor `local`): consume la API en
 * http://10.0.2.2:8000 según openapi.yaml (RNF-C-3, RD-05).
 *
 * - `GET /api/v1/publico/riesgo`: GeoJSON → dominio; alimenta la caché R-8.
 * - Detalle: si el endpoint responde 404 (stub ausente en `develop`),
 *   respaldo temporal con las `properties` de la lista (informado).
 */
@Singleton
class RemotePuntosRepository
    @Inject
    constructor(
        private val api: PublicoApi,
        private val cache: CachePuntosPublicos,
    ) : PuntosRepository {
        override suspend fun obtenerPuntos(
            comuna: String?,
            bbox: String?,
        ): Result<List<PuntoCritico>> =
            withContext(Dispatchers.IO) {
                runCatching {
                    val fc = api.puntos(comuna, bbox)
                    cache.guardar(fc)
                    Mapeadores.aPuntos(fc)
                }
            }

        override suspend fun obtenerDetalle(idPunto: Int): Result<DetallePuntoCritico> =
            withContext(Dispatchers.IO) {
                runCatching<DetallePuntoCritico> {
                    try {
                        Mapeadores.aDetalle(api.detalle(idPunto))
                            ?: error("Respuesta con nivel_riesgo inválido")
                    } catch (e: HttpException) {
                        if (e.code() == 404) {
                            // Stub ausente en develop: respaldo con properties de la lista.
                            val punto =
                                cache.cargar().firstOrNull { it.idPunto == idPunto }
                                    ?: throw e
                            Mapeadores.aDetalleRespaldo(punto)
                        } else {
                            throw e
                        }
                    }
                }
            }
    }
