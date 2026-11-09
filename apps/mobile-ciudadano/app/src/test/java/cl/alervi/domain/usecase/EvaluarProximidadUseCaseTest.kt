package cl.alervi.domain.usecase

import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PatronSonoro
import cl.alervi.domain.model.Telemetria
import cl.alervi.domain.usecase.ProyeccionUtm18STest.Companion.punto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas del caso de uso puro de alertas (RF-8; RB-13 y RB-14, E1 §6;
 * TC-22, TC-23 y TC-29 del catálogo E1 §11.2).
 *
 * Geometría de referencia: usuario en (-73.05, -36.83), rumbo ESTE (90°).
 * 1° de longitud ≈ 89.080 m en esa latitud; 1° de latitud ≈ 111.320 m.
 */
class EvaluarProximidadUseCaseTest {

    private val useCase = EvaluarProximidadUseCase()
    private val ahora = 1_772_000_000_000L

    private val lonBase = -73.05
    private val latBase = -36.83
    private val mPorGradoLon = 89_080.0
    private val mPorGradoLat = 111_320.0

    private fun lonEsteDe(metros: Double) = lonBase + metros / mPorGradoLon

    private fun latNorteDe(metros: Double) = latBase + metros / mPorGradoLat

    private fun telemetria(
        vel: Double = 13.889, // 50 km/h
        rumbo: Double? = 90.0, // Este
        precision: Double? = 8.5,
        antiguedadMs: Long = 1_000,
    ) = Telemetria(
        idSesion = "sesion-test",
        latitud = latBase,
        longitud = lonBase,
        velocidadMps = vel,
        rumboGrados = rumbo,
        precisionM = precision,
        timestampMs = ahora - antiguedadMs,
    )

    // ------------------------- RB-13: validez ---------------------------------

    @Test
    fun `TC-23 telemetria con antiguedad mayor a 5 s se suprime como obsoleta`() {
        val r = useCase.evaluar(telemetria(antiguedadMs = 5_001), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.TELEMETRIA_OBSOLETA, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-23 precision mayor a 30 m se suprime`() {
        val r = useCase.evaluar(telemetria(precision = 30.5), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.BAJA_PRECISION_GPS, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-23 precision ausente se suprime por falta de evidencia de validez`() {
        val r = useCase.evaluar(telemetria(precision = null), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.BAJA_PRECISION_GPS, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `antiguedad y precision exactamente en el limite son validas`() {
        val r = useCase.evaluar(telemetria(antiguedadMs = 5_000, precision = 30.0), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertTrue(r is EvaluacionAlerta.ConAlerta)
    }

    @Test
    fun `TC-23 velocidad bajo 1,38 m por s (detencion o congestion) se suprime`() {
        val r = useCase.evaluar(telemetria(vel = 1.0), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_VELOCIDAD_BAJA, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `velocidad exactamente 1,38 m por s con punto cercano si alerta`() {
        val r = useCase.evaluar(telemetria(vel = 1.38), listOf(punto(1, lonEsteDe(15.0), latBase)), emptySet(), ahora)
        assertTrue(r is EvaluacionAlerta.ConAlerta)
    }

    @Test
    fun `rumbo ausente impide verificar convergencia y se suprime`() {
        val r = useCase.evaluar(telemetria(rumbo = null), listOf(punto(1, lonEsteDe(100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_TRAYECTORIA_DIVERGENTE, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    // ------------------- RB-13: cinemática UTM 18S ----------------------------

    @Test
    fun `TC-22 aproximacion convergente con TTC menor o igual a 12 s emite alerta`() {
        // Punto a 100 m al este, 50 km/h → TTC ≈ 7,2 s.
        val r =
            useCase.evaluar(
                telemetria(),
                listOf(punto(101, lonEsteDe(100.0), latBase)),
                emptySet(),
                ahora,
            ) as EvaluacionAlerta.ConAlerta
        assertEquals(101, r.alerta.idPunto)
        assertTrue("distancia ≈ 100 m, fue ${r.alerta.distanciaM}", r.alerta.distanciaM in 99.0..101.0)
        assertTrue("TTC ≈ 7,2 s, fue ${r.alerta.ttcSegundos}", r.alerta.ttcSegundos in 7.0..7.4)
        assertTrue(r.alerta.mensajeVisual.contains("Zona de riesgo"))
        assertTrue(r.calculadaEnCliente)
    }

    @Test
    fun `TC-23 trayectoria en alejamiento (producto escalar negativo) no alerta`() {
        // Punto a 100 m al OESTE: el usuario se aleja rumbo Este.
        val r = useCase.evaluar(telemetria(), listOf(punto(1, lonEsteDe(-100.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_TRAYECTORIA_DIVERGENTE, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-23 producto escalar nulo (punto perpendicular) no divide ni alerta`() {
        // Punto a 100 m al norte de la CUADRÍCULA UTM 18S del usuario (relX ≈ 0):
        // con rumbo Este, el producto escalar es nulo. Nota: un punto "al norte
        // en lat/lon" NO es perpendicular en UTM por la convergencia de
        // meridianos (relX ≈ +2 m), lo que confirma RD-06 (cálculo en métrico).
        // Coordenadas obtenidas por inversa EPSG:32718 → WGS 84.
        val r = useCase.evaluar(telemetria(), listOf(punto(1, -73.050022873, -36.829099055)), emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_TRAYECTORIA_DIVERGENTE, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-23 TTC mayor a 12 s no activa la advertencia todavia`() {
        // 300 m / 13,889 m/s ≈ 21,6 s > 12 s.
        val r = useCase.evaluar(telemetria(), listOf(punto(1, lonEsteDe(300.0), latBase)), emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_TTC_MAYOR_12S, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-23 punto lateral no alerta aunque su proyeccion longitudinal sea corta`() {
        // Punto a 100 m al este y 400 m al norte, rumbo ESTE: producto escalar
        // positivo, pero distancia real 412 m → TTC ≈ 29,7 s > 12 s. La
        // proyección longitudinal sola habría dado 7,2 s y un falso positivo.
        val r =
            useCase.evaluar(
                telemetria(),
                listOf(punto(1, lonEsteDe(100.0), latNorteDe(400.0))),
                emptySet(),
                ahora,
            )
        assertEquals(MotivoSupresion.SUPRIMIDO_TTC_MAYOR_12S, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TTC exactamente 12 s si alerta (limite inclusive)`() {
        // 12 s × 13,889 m/s ≈ 166,7 m al este.
        val r = useCase.evaluar(telemetria(), listOf(punto(1, lonEsteDe(166.0), latBase)), emptySet(), ahora)
        assertTrue(r is EvaluacionAlerta.ConAlerta)
    }

    @Test
    fun `sin puntos conocidos se informa SIN_PUNTOS_EN_RANGO`() {
        val r = useCase.evaluar(telemetria(), emptyList(), emptySet(), ahora)
        assertEquals(MotivoSupresion.SIN_PUNTOS_EN_RANGO, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    // ------------------- RB-14: sesión y concurrencia --------------------------

    @Test
    fun `TC-29 punto ya advertido en la sesion no repite aviso`() {
        val r = useCase.evaluar(telemetria(), listOf(punto(101, lonEsteDe(100.0), latBase)), setOf(101), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_PUNTO_YA_ADVERTIDO, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `TC-29 entre varios elegibles gana el de menor TTC`() {
        val puntos =
            listOf(
                punto(201, lonEsteDe(100.0), latBase), // TTC ≈ 7,2 s
                punto(202, lonEsteDe(60.0), latBase), // TTC ≈ 4,3 s
            )
        val r = useCase.evaluar(telemetria(), puntos, emptySet(), ahora) as EvaluacionAlerta.ConAlerta
        assertEquals(202, r.alerta.idPunto)
    }

    @Test
    fun `TC-29 empate de TTC se resuelve por menor id_punto`() {
        // Dos puntos a 100 m al este con desvío norte/sur de 5 m: mismo TTC.
        val puntos =
            listOf(
                punto(301, lonEsteDe(100.0), latNorteDe(5.0)),
                punto(205, lonEsteDe(100.0), latNorteDe(-5.0)),
            )
        val r = useCase.evaluar(telemetria(), puntos, emptySet(), ahora) as EvaluacionAlerta.ConAlerta
        assertEquals(205, r.alerta.idPunto)
    }

    @Test
    fun `RB-13 y RB-14 combinados - punto advertido y otro elegible distinto si alerta`() {
        val puntos =
            listOf(
                punto(201, lonEsteDe(100.0), latBase),
                punto(202, lonEsteDe(60.0), latBase),
            )
        val r = useCase.evaluar(telemetria(), puntos, setOf(202), ahora) as EvaluacionAlerta.ConAlerta
        assertEquals(201, r.alerta.idPunto)
    }

    @Test
    fun `patron sonoro segun nivel de riesgo del punto`() {
        val critico = useCase.evaluar(telemetria(), listOf(punto(1, lonEsteDe(100.0), latBase, NivelRiesgo.CRITICO)), emptySet(), ahora)
        assertEquals(PatronSonoro.BEEP_URGENTE, (critico as EvaluacionAlerta.ConAlerta).alerta.patronSonoro)

        val medio = useCase.evaluar(telemetria(), listOf(punto(1, lonEsteDe(100.0), latBase, NivelRiesgo.MEDIO)), emptySet(), ahora)
        assertEquals(PatronSonoro.TONO_CORTO, (medio as EvaluacionAlerta.ConAlerta).alerta.patronSonoro)
    }

    @Test
    fun `mezcla de divergente y TTC largo sin elegibles informa TTC mayor 12 s`() {
        val puntos =
            listOf(
                punto(1, lonEsteDe(-100.0), latBase), // divergente
                punto(2, lonEsteDe(300.0), latBase), // TTC ≈ 21,6 s
            )
        val r = useCase.evaluar(telemetria(), puntos, emptySet(), ahora)
        assertEquals(MotivoSupresion.SUPRIMIDO_TTC_MAYOR_12S, (r as EvaluacionAlerta.Suprimida).motivo)
    }

    @Test
    fun `la telemetria nunca expone coordenadas en su representacion (RNF-S-8)`() {
        val t = telemetria()
        val texto = t.toString()
        assertFalse("el toString no debe exponer la longitud", texto.contains("-73"))
        assertFalse("el toString no debe exponer la latitud", texto.contains("-36"))
    }
}
