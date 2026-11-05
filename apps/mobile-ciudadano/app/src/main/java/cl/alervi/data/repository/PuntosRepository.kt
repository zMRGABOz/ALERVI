package cl.alervi.data.repository

import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.PuntoCritico

/**
 * Repositorio de puntos críticos públicos (RF-2).
 *
 * Implementaciones inyectadas con Hilt según flavor:
 *  - `mock` : fixtures JSON locales que cumplen openapi.yaml (sin red).
 *  - `local`: `PublicoApi` contra http://10.0.2.2:8000.
 *
 * Distinción obligatoria para la UI (TC-06 vs TC-07, E1 §11.2):
 *  - lista vacía  → Result.success(emptyList())  ⇒ «sin puntos disponibles».
 *  - falla de red → Result.failure               ⇒ error + reintentar.
 */
interface PuntosRepository {
    /**
     * Obtiene la capa pública de puntos críticos (opcionalmente filtrada por
     * comuna y bbox "minLon,minLat,maxLon,maxLat", openapi.yaml).
     */
    suspend fun obtenerPuntos(
        comuna: String? = null,
        bbox: String? = null,
    ): Result<List<PuntoCritico>>

    /**
     * Detalle público extendido de un punto. En `local`, si el endpoint de
     * detalle responde 404 (stub ausente en `develop`), devuelve el respaldo
     * construido desde las `properties` de la lista con
     * [DetallePuntoCritico.origen] = RESPALDO_LISTA (informado al usuario).
     */
    suspend fun obtenerDetalle(idPunto: Int): Result<DetallePuntoCritico>
}
