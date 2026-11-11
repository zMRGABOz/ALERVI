package cl.alervi.data.mapper

import cl.alervi.data.api.dto.AlertCheckRequestDto
import cl.alervi.data.api.dto.AlertCheckResponseDto
import cl.alervi.data.api.dto.AlertDetailDto
import cl.alervi.data.api.dto.GeoJsonFeatureCollectionDto
import cl.alervi.data.api.dto.GeoJsonFeatureDto
import cl.alervi.data.api.dto.GeoJsonPointDto
import cl.alervi.data.api.dto.PuntoCriticoPropertiesDto
import cl.alervi.data.api.dto.PuntoCriticoPublicDetailDto
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.OrigenDetalle
import cl.alervi.domain.model.PatronSonoro
import cl.alervi.domain.model.Telemetria
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas de los mapeadores DTO ↔ dominio contra el contrato openapi.yaml
 * (RNF-C-3; orden de coordenadas GeoJSON [lon, lat], RD-06).
 */
class MapeadoresTest {

    private val json = Json { explicitNulls = false; encodeDefaults = false }

    private fun props(
        id: Int = 101,
        nivel: String = "ALTO",
    ) = PuntoCriticoPropertiesDto(
        idPunto = id,
        nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
        comuna = "Concepción",
        nivelRiesgo = nivel,
        indicePrioridad = 78.5,
        totalSiniestros = 24,
    )

    // ---------------------- GeoJSON → puntos ----------------------------------

    @Test
    fun `las coordenadas GeoJSON respetan el orden longitud-latitud (RD-06)`() {
        val fc =
            GeoJsonFeatureCollectionDto(
                type = "FeatureCollection",
                features =
                    listOf(
                        GeoJsonFeatureDto(
                            type = "Feature",
                            id = 101,
                            geometry = GeoJsonPointDto(type = "Point", coordinates = listOf(-73.0543, -36.8271)),
                            properties = props(),
                        ),
                    ),
            )
        val punto = Mapeadores.aPuntos(fc).single()
        assertEquals(-73.0543, punto.longitud, 1e-9) // longitud primero
        assertEquals(-36.8271, punto.latitud, 1e-9) // latitud segundo
        assertEquals(101, punto.idPunto)
    }

    @Test
    fun `features con geometria invalida se descartan sin inventar datos`() {
        val fc =
            GeoJsonFeatureCollectionDto(
                type = "FeatureCollection",
                features =
                    listOf(
                        GeoJsonFeatureDto("Feature", 1, GeoJsonPointDto("Point", listOf(-73.0)), props(1)),
                        GeoJsonFeatureDto("Feature", 2, GeoJsonPointDto("Point", listOf(-73.0, -36.8, 12.0)), props(2)),
                        GeoJsonFeatureDto("Feature", 3, GeoJsonPointDto("LineString", listOf(-73.0, -36.8)), props(3)),
                        GeoJsonFeatureDto("Feature", 4, GeoJsonPointDto("Point", listOf(-73.0, -36.8)), props(4, nivel = "EXTREMO")),
                        GeoJsonFeatureDto("Feature", 5, GeoJsonPointDto("Point", listOf(-73.0, -36.8)), props(5)),
                    ),
            )
        val puntos = Mapeadores.aPuntos(fc)
        assertEquals(listOf(5), puntos.map { it.idPunto })
    }

    @Test
    fun `coleccion vacia mapea a lista vacia (TC-06 ausencia, no error)`() {
        val fc = GeoJsonFeatureCollectionDto(type = "FeatureCollection")
        assertTrue(Mapeadores.aPuntos(fc).isEmpty())
    }

    // ---------------------- Detalle -------------------------------------------

    @Test
    fun `el detalle del contrato mapea completo con origen API`() {
        val dto =
            PuntoCriticoPublicDetailDto(
                idPunto = 101,
                nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
                comuna = "Concepción",
                latitud = -36.8271,
                longitud = -73.0543,
                nivelRiesgo = "ALTO",
                indicePrioridad = 78.5,
                totalSiniestros = 24,
                totalFallecidos = 2,
                totalGraves = 7,
                totalLeves = 15,
                tendencia = "ALZA",
                periodoDatos = "2020 - 2025",
                colegioCercanoM = 85,
                paraderoCercanoM = 30,
                explicacionCiudadana = "Zona clasificada como de alto riesgo.",
                advertenciaLegal = "El índice expresa prioridad relativa.",
            )
        val detalle = Mapeadores.aDetalle(dto)!!
        assertEquals(OrigenDetalle.API, detalle.origen)
        assertEquals("2020 - 2025", detalle.periodoDatos)
        assertEquals(85, detalle.colegioCercanoM)
        assertEquals(15, detalle.totalLeves)
    }

    @Test
    fun `el respaldo desde properties marca origen RESPALDO_LISTA y no inventa periodo`() {
        val fc =
            GeoJsonFeatureCollectionDto(
                type = "FeatureCollection",
                features =
                    listOf(
                        GeoJsonFeatureDto("Feature", 101, GeoJsonPointDto("Point", listOf(-73.0543, -36.8271)), props()),
                    ),
            )
        val punto = Mapeadores.aPuntos(fc).single()
        val detalle = Mapeadores.aDetalleRespaldo(punto)
        assertEquals(OrigenDetalle.RESPALDO_LISTA, detalle.origen)
        assertNull(detalle.periodoDatos) // RB-2: sin dato, no se inventa
        assertTrue(detalle.advertenciaLegal.contains("prioridad")) // RB-6 presente
    }

    // ---------------------- AlertCheckRequest ---------------------------------

    @Test
    fun `la telemetria serializa con los nombres exactos del contrato`() {
        val t =
            Telemetria(
                idSesion = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                latitud = -36.8285,
                longitud = -73.0550,
                velocidadMps = 13.88,
                rumboGrados = 45.0,
                precisionM = 8.5,
                timestampMs = 1_772_000_000_000L,
            )
        val dto = Mapeadores.aAlertCheckRequest(t)
        val texto = json.encodeToString(AlertCheckRequestDto.serializer(), dto)
        // Claves exactas de openapi.yaml (RNF-C-3):
        listOf(
            "session_id", "latitude", "longitude", "speed_mps",
            "heading_degrees", "accuracy_m", "timestamp",
        ).forEach { clave -> assertTrue("falta la clave $clave", texto.contains("\"$clave\"")) }
        assertEquals("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", dto.sessionId)
    }

    // ---------------------- AlertCheckResponse --------------------------------

    @Test
    fun `respuesta con alerta activa mapea a ConAlerta de origen servidor`() {
        val dto =
            AlertCheckResponseDto(
                alertaActiva = true,
                telemetriaStatus = "EVALUADO_CON_ALERTA",
                alerta =
                    AlertDetailDto(
                        idPunto = 101,
                        nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
                        nivelRiesgo = "ALTO",
                        distanciaM = 112.5,
                        ttcSegundos = 8.1,
                        mensajeVisual = "⚠️ Zona de Riesgo a 110 m: Paicaví / Carrera",
                        patronSonoro = "BEEP_PRECAUCION",
                        instruccionSeguridad = "Reduzca velocidad y preste atención al cruce",
                    ),
            )
        val r = Mapeadores.aEvaluacion(dto) as EvaluacionAlerta.ConAlerta
        assertEquals(101, r.alerta.idPunto)
        assertEquals(112.5, r.alerta.distanciaM, 1e-9)
        assertTrue(!r.calculadaEnCliente)
    }

    @Test
    fun `respuesta suprimida mapea el motivo exacto del contrato`() {
        val dto = AlertCheckResponseDto(alertaActiva = false, telemetriaStatus = "SUPRIMIDO_TTC_MAYOR_12S")
        val r = Mapeadores.aEvaluacion(dto) as EvaluacionAlerta.Suprimida
        assertEquals(MotivoSupresion.SUPRIMIDO_TTC_MAYOR_12S, r.motivo)
    }

    @Test
    fun `detalle con nivel fuera del contrato se descarta sin inventar datos`() {
        val dto =
            PuntoCriticoPublicDetailDto(
                idPunto = 101,
                nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
                comuna = "Concepción",
                latitud = -36.8271,
                longitud = -73.0543,
                nivelRiesgo = "EXTREMO",
                indicePrioridad = 78.5,
                totalSiniestros = 24,
                advertenciaLegal = "Índice relativo (RB-6).",
            )

        assertNull(Mapeadores.aDetalle(dto))
    }

    @Test
    fun `respuesta activa sin alerta o con estado desconocido se suprime`() {
        val sinAlerta =
            AlertCheckResponseDto(
                alertaActiva = true,
                telemetriaStatus = "ESTADO_FUERA_DE_CONTRATO",
                alerta = null,
            )

        val r = Mapeadores.aEvaluacion(sinAlerta) as EvaluacionAlerta.Suprimida
        assertEquals(MotivoSupresion.SIN_PUNTOS_EN_RANGO, r.motivo)
    }

    @Test
    fun `alerta con enums fuera del contrato usa fallbacks de representacion`() {
        val dto =
            AlertCheckResponseDto(
                alertaActiva = true,
                telemetriaStatus = "EVALUADO_CON_ALERTA",
                alerta =
                    AlertDetailDto(
                        idPunto = 101,
                        nombreInterseccion = "Av. Paicaví con Av. Los Carrera",
                        nivelRiesgo = "EXTREMO",
                        distanciaM = 112.5,
                        ttcSegundos = 8.1,
                        mensajeVisual = "Zona de riesgo",
                        patronSonoro = "RUIDO",
                        instruccionSeguridad = "Reduzca la velocidad",
                    ),
            )

        val alerta = (Mapeadores.aEvaluacion(dto) as EvaluacionAlerta.ConAlerta).alerta
        assertEquals(NivelRiesgo.MEDIO, alerta.nivelRiesgo)
        assertEquals(PatronSonoro.TONO_CORTO, alerta.patronSonoro)
    }
}
