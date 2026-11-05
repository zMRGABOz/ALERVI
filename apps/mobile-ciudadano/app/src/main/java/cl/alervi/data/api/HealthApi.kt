package cl.alervi.data.api

import cl.alervi.data.api.dto.HealthResponseDto
import retrofit2.http.GET

/**
 * `GET /health` según openapi.yaml (monitoreo/keep-alive, RNF-D-1).
 */
interface HealthApi {
    @GET("health")
    suspend fun salud(): HealthResponseDto
}
