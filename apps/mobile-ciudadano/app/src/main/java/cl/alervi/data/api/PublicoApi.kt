package cl.alervi.data.api

import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.api.dto.PuntoCriticoPublicDetailDto
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Endpoints públicos del mapa (RF-2) según openapi.yaml.
 *
 * - `GET /api/v1/publico/riesgo` → GeoJSON de puntos críticos (seguridad: []).
 * - `GET /api/v1/publico/riesgo/{id_punto}` → detalle público extendido.
 *   NOTA: el backend de `develop` aún NO implementa el detalle (404);
 *   el repositorio aplica el respaldo con `properties` de la lista.
 */
interface PublicoApi {
    @GET("api/v1/publico/riesgo")
    suspend fun puntos(
        @Query("comuna") comuna: String? = null,
        @Query("bbox") bbox: String? = null,
    ): GeoJsonFeatureCollectionDto

    @GET("api/v1/publico/riesgo/{id_punto}")
    suspend fun detalle(
        @Path("id_punto") idPunto: Int,
    ): PuntoCriticoPublicDetailDto
}
