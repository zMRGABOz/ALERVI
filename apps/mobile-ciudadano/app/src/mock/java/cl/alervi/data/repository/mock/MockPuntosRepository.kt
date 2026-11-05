package cl.alervi.data.repository.mock

import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.mapper.Mapeadores
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.OrigenDetalle
import cl.alervi.domain.model.PuntoCritico
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * Repositorio del flavor `mock` (RD-01: 100 % sin backend ni red).
 *
 * Carga fixtures JSON locales que CUMPLEN openapi.yaml
 * (`assets/fixtures/puntos_criticos_publicos.json`) y los mapea con los
 * mismos mapeadores del camino remoto, de modo que `mock` y `local`
 * ejercen idéntico pipeline de contrato → dominio.
 */
@Singleton
class MockPuntosRepository
    @Inject
    constructor(
        private val json: Json,
        private val proveedorFixture: () -> String,
    ) : PuntosRepository {
        private var cachePuntos: List<PuntoCritico>? = null

        private suspend fun puntos(): List<PuntoCritico> =
            withContext(Dispatchers.IO) {
                cachePuntos ?: run {
                    val fc = json.decodeFromString<GeoJsonFeatureCollectionDto>(proveedorFixture())
                    Mapeadores.aPuntos(fc).also { cachePuntos = it }
                }
            }

        override suspend fun obtenerPuntos(
            comuna: String?,
            bbox: String?,
        ): Result<List<PuntoCritico>> =
            runCatching {
                val todos = puntos()
                todos
                    .asSequence()
                    .filter { comuna == null || it.comuna.equals(comuna, ignoreCase = true) }
                    .toList()
            }

        override suspend fun obtenerDetalle(idPunto: Int): Result<DetallePuntoCritico> =
            runCatching {
                val punto = puntos().firstOrNull { it.idPunto == idPunto }
                    ?: throw NoSuchElementException("Punto $idPunto no existe en fixtures")
                val respaldo = Mapeadores.aDetalleRespaldo(punto)
                respaldo.copy(origen = OrigenDetalle.SIMULADO)
            }
    }
