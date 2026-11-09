package cl.alervi.domain.usecase

import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pruebas de la proyección WGS 84 → UTM 18S (RD-06, RNF-C-4).
 *
 * Valores de referencia calculados con pyproj (EPSG:4326 → EPSG:32718,
 * transformación estándar, 4 nov 2026):
 *  (-73.0543, -36.8271)  → E=673521.4047  N=5922541.3020
 *  (-73.0500, -36.8300)  → E=673898.3628  N=5922211.7337
 *  (-73.0910, -36.8500)  → E=670197.3053  N=5920066.6252
 *  (-72.9800, -36.7800)  → E=680258.8089  N=5927629.4863
 *  (-73.0609, -36.8301)  → E=672925.9847  N=5922220.4244
 */
class ProyeccionUtm18STest {

    private data class Referencia(
        val lon: Double,
        val lat: Double,
        val este: Double,
        val norte: Double,
    )

    private val referencias =
        listOf(
            Referencia(-73.0543, -36.8271, 673521.4047, 5922541.3020),
            Referencia(-73.0500, -36.8300, 673898.3628, 5922211.7337),
            Referencia(-73.0910, -36.8500, 670197.3053, 5920066.6252),
            Referencia(-72.9800, -36.7800, 680258.8089, 5927629.4863),
            Referencia(-73.0609, -36.8301, 672925.9847, 5922220.4244),
        )

    @Test
    fun `la proyeccion coincide con pyproj dentro de un milimetro`() {
        for (r in referencias) {
            val utm = ProyeccionUtm18S.proyectar(r.lon, r.lat)
            assertEquals("este para (${r.lon}, ${r.lat})", r.este, utm.este, 0.001)
            assertEquals("norte para (${r.lon}, ${r.lat})", r.norte, utm.norte, 0.001)
        }
    }

    @Test
    fun `la distancia metrica entre dos puntos conocidos es consistente con la proyeccion`() {
        // Referencias pyproj: (-73.0543,-36.8271) → (673521.4047, 5922541.3020)
        // y (-73.0609,-36.8301) → (672925.9847, 5922220.4244): dE≈595,4 m y
        // dN≈320,9 m ⇒ distancia plana ≈ 676,4 m.
        val d =
            ProyeccionUtm18S.distanciaMetros(-73.0543, -36.8271, -73.0609, -36.8301)
        assertTrue("distancia esperada ~676 m, fue $d", d in 672.0..680.0)
    }

    @Test
    fun `grados jamas se tratan como metros - diferencias de 1 grado no son 1 metro`() {
        val d = ProyeccionUtm18S.distanciaMetros(-73.0, -36.8, -74.0, -36.8)
        assertTrue("1 grado de longitud ≈ 89 km en esta latitud, fue $d", d in 88_000.0..91_000.0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `latitud fuera de rango es rechazada`() {
        ProyeccionUtm18S.proyectar(-73.0, 95.0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `longitud fuera de rango es rechazada`() {
        ProyeccionUtm18S.proyectar(-200.0, -36.8)
    }

    companion object {
        /** Punto utilitario para otras pruebas. */
        fun punto(
            id: Int,
            lon: Double,
            lat: Double,
            nivel: NivelRiesgo = NivelRiesgo.ALTO,
        ): PuntoCritico =
            PuntoCritico(
                idPunto = id,
                longitud = lon,
                latitud = lat,
                nombreInterseccion = "Punto $id",
                comuna = "Concepción",
                nivelRiesgo = nivel,
                indicePrioridad = 50.0,
                totalSiniestros = 10,
            )
    }
}
