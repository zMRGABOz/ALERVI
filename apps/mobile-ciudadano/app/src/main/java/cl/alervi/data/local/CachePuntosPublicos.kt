package cl.alervi.data.local

import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.mapper.Mapeadores
import cl.alervi.domain.model.PuntoCritico
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Caché local de puntos críticos PÚBLICOS (R-8, E1 §12).
 *
 * Respaldo del modo degradado: la capa `GET /api/v1/publico/riesgo` se
 * descarga al iniciar con conexión y se conserva localmente para calcular
 * el TTC en el cliente si `POST /api/v1/alerts` no responde en 3 s.
 *
 * RNF-S-8: aquí SOLO se persisten datos públicos de los puntos (id, nombre,
 * nivel, coordenadas de PUNTOS). Ninguna coordenada del dispositivo se
 * escribe en archivos.
 *
 * La instancia la provee el módulo Hilt con `filesDir` de la app; el
 * constructor con directorio permite probarla en JVM.
 */
class CachePuntosPublicos(
    private val json: Json,
    directorioBase: File,
) {
    private val archivo = File(directorioBase, NOMBRE_ARCHIVO)
    private var memoria: List<PuntoCritico> = emptyList()
    private val mutex = Mutex()

    /** Guarda la capa recibida (memoria + archivo). */
    suspend fun guardar(fc: GeoJsonFeatureCollectionDto): Unit =
        mutex.withLock {
            memoria = Mapeadores.aPuntos(fc)
            withContext(Dispatchers.IO) {
                runCatching { archivo.parentFile?.mkdirs(); archivo.writeText(json.encodeToString(fc)) }
            }
        }

    /**
     * Devuelve la caché: memoria si existe; si no, el archivo persistido.
     * Lista vacía si nunca se descargó la capa.
     */
    suspend fun cargar(): List<PuntoCritico> =
        mutex.withLock {
            if (memoria.isNotEmpty()) return@withLock memoria
            withContext(Dispatchers.IO) {
                val texto =
                    runCatching { archivo.readText() }.getOrNull()
                        ?: return@withContext emptyList()
                val fc =
                    runCatching { json.decodeFromString<GeoJsonFeatureCollectionDto>(texto) }
                        .getOrNull() ?: return@withContext emptyList()
                Mapeadores.aPuntos(fc).also { memoria = it }
            }
        }

    private companion object {
        const val NOMBRE_ARCHIVO = "cache_puntos_publicos.json"
    }
}
