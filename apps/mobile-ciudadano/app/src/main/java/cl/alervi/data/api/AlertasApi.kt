package cl.alervi.data.api

import cl.alervi.data.api.dto.AlertCheckRequestDto
import cl.alervi.data.api.dto.AlertCheckResponseDto
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * `POST /api/v1/alerts` (RF-8) según openapi.yaml.
 *
 * RNF-S-8 & Ley 21.719: las coordenadas viajan SOLO en el cuerpo JSON
 * (nunca en la URL) y no se almacenan ni se registran en el servidor.
 *
 * El cliente de red asociado usa timeout de 3 s (R-8); si expira, el
 * repositorio calcula la alerta localmente con la caché de puntos.
 */
interface AlertasApi {
    @POST("api/v1/alerts")
    suspend fun evaluar(
        @Body telemetria: AlertCheckRequestDto,
    ): AlertCheckResponseDto
}
