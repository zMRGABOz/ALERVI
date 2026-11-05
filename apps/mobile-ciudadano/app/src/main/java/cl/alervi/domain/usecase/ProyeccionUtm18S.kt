package cl.alervi.domain.usecase

import kotlin.math.abs
import kotlin.math.asinh
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sinh
import kotlin.math.sqrt

/**
 * Proyección WGS 84 → UTM Huso 18 Sur (EPSG:32718) para cálculos métricos.
 *
 * Respaldo: RD-06 y RNF-C-4 (E1 §2.6/§4.5): coordenadas WGS 84 (SRID 4326)
 * para intercambio (RFC 7946) y UTM huso 18S para cálculos en metros.
 * Prohibido tratar grados como metros.
 *
 * Implementación: serie de Krüger (6 términos, Karney 2011) sobre el
 * elipsoide WGS 84. Precisión submilimétrica dentro del huso (contrastada
 * contra pyproj/EPSG:32718 en pruebas unitarias).
 *
 * Huso 18: longitud 78°O … 72°O, meridiano central λ0 = 75°O; hemisferio
 * sur ⇒ falso norte 10.000.000 m; factor k0 = 0,9996.
 */
object ProyeccionUtm18S {

    private const val A = 6_378_137.0 // semieje mayor WGS 84 (m)
    private val F = 1.0 / 298.257_223_563 // aplanamiento WGS 84
    private const val K0 = 0.9996
    private val LAMBDA0 = Math.toRadians(-75.0) // meridiano central huso 18
    private const val ESTE_FALSO = 500_000.0
    private const val NORTE_FALSO_SUR = 10_000_000.0

    private val E = sqrt(2.0 * F - F * F) // primera excentricidad
    private val N = F / (2.0 - F) // n de Krüger
    private val A_PRIMARIA = A / (1.0 + N) * (1.0 + N.pow(2) / 4.0 + N.pow(4) / 64.0 + N.pow(6) / 256.0)

    // Coeficientes α1..α6 de la serie de Krüger (Karney 2011).
    private val ALFAS: List<Double> =
        listOf(
            (1.0 / 2.0) * N - (2.0 / 3.0) * N.pow(2) + (5.0 / 16.0) * N.pow(3) +
                (41.0 / 180.0) * N.pow(4) - (127.0 / 288.0) * N.pow(5) + (7891.0 / 37800.0) * N.pow(6),
            (13.0 / 48.0) * N.pow(2) - (3.0 / 5.0) * N.pow(3) + (557.0 / 1440.0) * N.pow(4) +
                (281.0 / 630.0) * N.pow(5) - (1983433.0 / 1935360.0) * N.pow(6),
            (61.0 / 240.0) * N.pow(3) - (103.0 / 140.0) * N.pow(4) + (15061.0 / 26880.0) * N.pow(5) +
                (167603.0 / 181440.0) * N.pow(6),
            (49561.0 / 161280.0) * N.pow(4) - (179.0 / 168.0) * N.pow(5) + (6601661.0 / 7257600.0) * N.pow(6),
            (34729.0 / 80640.0) * N.pow(5) - (3418889.0 / 1995840.0) * N.pow(6),
            (212378941.0 / 319334400.0) * N.pow(6),
        )

    /** Coordenadas UTM 18S en metros (este, norte). */
    data class CoordenadasUtm(
        val este: Double,
        val norte: Double,
    )

    /**
     * Proyecta un punto WGS 84 (grados decimales) a UTM 18S (metros).
     *
     * @param longitudDeg longitud en grados (negativa al oeste; orden GeoJSON).
     * @param latitudDeg latitud en grados (negativa al sur).
     */
    fun proyectar(longitudDeg: Double, latitudDeg: Double): CoordenadasUtm {
        require(latitudDeg in -90.0..90.0) { "Latitud fuera de rango: se requiere WGS 84 (RD-06)" }
        require(longitudDeg in -180.0..180.0) { "Longitud fuera de rango: se requiere WGS 84 (RD-06)" }

        val phi = Math.toRadians(latitudDeg)
        val lambdaPrima = Math.toRadians(longitudDeg) - LAMBDA0

        // Latitud conforme (Karney 2011): t = sinh(atanh(sin φ) − e·atanh(e·sin φ))
        val sinPhi = sin(phi)
        val t = sinh(atanh(sinPhi) - E * atanh(E * sinPhi))

        // Coordenadas esféricas normalizadas:
        // ξ′ = atan2(t, cos λ′) ; η′ = asinh( sin λ′ / hypot(t, cos λ′) )
        val cosLambda = cos(lambdaPrima)
        val xiPrima = atan2(t, cosLambda)
        val etaPrima = asinh(sin(lambdaPrima) / hypot(t, cosLambda))

        // Serie de Krüger hacia (ξ, η).
        var xi = xiPrima
        var eta = etaPrima
        var j = 1
        for (alfa in ALFAS) {
            val dosJ = 2.0 * j
            xi += alfa * sin(dosJ * xiPrima) * cosh(dosJ * etaPrima)
            eta += alfa * cos(dosJ * xiPrima) * sinh(dosJ * etaPrima)
            j++
        }

        val este = K0 * A_PRIMARIA * eta + ESTE_FALSO
        val norte = K0 * A_PRIMARIA * xi + NORTE_FALSO_SUR // hemisferio sur

        return CoordenadasUtm(este = este, norte = norte)
    }

    /**
     * Distancia plana en metros entre dos puntos WGS 84 proyectados a UTM 18S
     * (RD-06/RNF-C-4: las magnitudes se calculan en coordenadas métricas).
     */
    fun distanciaMetros(
        lon1: Double,
        lat1: Double,
        lon2: Double,
        lat2: Double,
    ): Double {
        val p1 = proyectar(lon1, lat1)
        val p2 = proyectar(lon2, lat2)
        return hypot(p2.este - p1.este, p2.norte - p1.norte)
    }

    private fun atanh(x: Double): Double = 0.5 * ln(abs((1.0 + x) / (1.0 - x)))

    private fun ln(x: Double): Double = kotlin.math.ln(x)

    private fun cosh(x: Double): Double = (exp(x) + exp(-x)) / 2.0
}
