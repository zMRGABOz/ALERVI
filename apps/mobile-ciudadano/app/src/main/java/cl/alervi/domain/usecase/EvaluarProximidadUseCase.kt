package cl.alervi.domain.usecase

import cl.alervi.domain.model.AlertCheckConstants
import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.EvaluacionAlerta
import cl.alervi.domain.model.MotivoSupresion
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PatronSonoro
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.domain.model.Telemetria
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * Caso de uso PURO de evaluación de alertas de proximidad (RF-8).
 *
 * Reglas aplicadas (E1 §6):
 * - **RB-13 (activación)**: ubicación válida (antigüedad ≤ 5 s y precisión
 *   ≤ 30 m), velocidad instantánea ≥ 1,38 m/s (≈ 5 km/h), trayectoria en
 *   dirección de acercamiento (producto escalar > 0) y TTC ≤ 12 s.
 *   Ante producto escalar nulo o negativo NO se evalúa la división.
 * - **RB-14 (repetición y concurrencia)**: máximo 1 aviso por punto por
 *   sesión; entre varios elegibles se selecciona el de menor TTC y, ante
 *   empate, el de menor id_punto.
 *
 * Magnitudes en UTM 18S (RD-06, RNF-C-4): nunca grados tratados como metros.
 *
 * Se usa tal cual en el flavor `mock` y como fallback local del cliente
 * cuando `POST /api/v1/alerts` no responde dentro de 3 s (R-8, E1 §12).
 */
@Singleton
class EvaluarProximidadUseCase
    @Inject
    constructor() {

        private companion object {
        /**
         * Avance mínimo (en metros) sobre la trayectoria para considerar que hay
         * acercamiento: por debajo de 1 mm el producto escalar se trata como NULO
         * (ruido numérico de la proyección; RB-13: nulo o negativo ⇒ no se divide).
         */
        const val EPSILON_AVANCE_M: Double = 1e-3
        }
        /**
         * Evalúa la telemetría vigente contra los puntos candidatos.
         *
         * @param telemetria posición/velocidad instantáneos (RNF-S-8: solo en memoria).
         * @param puntos candidatos (p. ej., caché local de puntos públicos, R-8).
         * @param puntosYaAdvertidos ids ya advertidos en la sesión (RB-14).
         * @param ahoraMs reloj de referencia para validar antigüedad (inyectable para pruebas).
         */
        fun evaluar(
            telemetria: Telemetria,
            puntos: List<PuntoCritico>,
            puntosYaAdvertidos: Set<Int>,
            ahoraMs: Long,
        ): EvaluacionAlerta {
            // --- RB-13: validez de la ubicación -------------------------------
            val antiguedadMs = ahoraMs - telemetria.timestampMs
            if (antiguedadMs > AlertCheckConstants.MAX_ANTIGUEDAD_MS) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.TELEMETRIA_OBSOLETA)
            }
            // Precisión: sin dato de precisión no hay evidencia de validez → se suprime.
            val precision = telemetria.precisionM
            if (precision == null || precision > AlertCheckConstants.MAX_PRECISION_M) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.BAJA_PRECISION_GPS)
            }
            if (telemetria.velocidadMps < AlertCheckConstants.MIN_VELOCIDAD_MPS) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.SUPRIMIDO_VELOCIDAD_BAJA)
            }
            // Sin rumbo no es posible verificar dirección de acercamiento.
            val rumbo = telemetria.rumboGrados
            if (rumbo == null) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.SUPRIMIDO_TRAYECTORIA_DIVERGENTE)
            }

            // --- Candidatura por sesión (RB-14) --------------------------------
            if (puntos.isEmpty()) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.SIN_PUNTOS_EN_RANGO)
            }
            val noAdvertidos = puntos.filter { it.idPunto !in puntosYaAdvertidos }
            if (noAdvertidos.isEmpty()) {
                return EvaluacionAlerta.Suprimida(MotivoSupresion.SUPRIMIDO_PUNTO_YA_ADVERTIDO)
            }

            // --- Cinemática en UTM 18S (RD-06/RNF-C-4) ------------------------
            val usuario = ProyeccionUtm18S.proyectar(telemetria.longitud, telemetria.latitud)
            val rumboRad = Math.toRadians(rumbo)
            // Vector velocidad: x = Este, y = Norte (rumbo 0° = Norte, 90° = Este).
            val vx = telemetria.velocidadMps * sin(rumboRad)
            val vy = telemetria.velocidadMps * cos(rumboRad)

            data class Elegible(val punto: PuntoCritico, val distanciaM: Double, val ttcS: Double)

            var enDireccionDeAcercamiento = 0
            val convergentes = mutableListOf<Elegible>()
            for (punto in noAdvertidos) {
                val p = ProyeccionUtm18S.proyectar(punto.longitud, punto.latitud)
                val relX = p.este - usuario.este
                val relY = p.norte - usuario.norte
                // Producto escalar velocidad · desplazamiento relativo.
                val productoEscalar = vx * relX + vy * relY
                // RB-13: producto escalar nulo o negativo ⇒ NO se divide.
                // Tolerancia numérica: el caso exactamente perpendicular es indistinguible
                // del ruido de proyección (~1e-4 m); se trata como nulo todo avance
                // sobre la trayectoria menor a 1 mm (EPSILON_AVANCE_M).
                val distancia = hypot(relX, relY)
                if (productoEscalar <= telemetria.velocidadMps * EPSILON_AVANCE_M) continue
                enDireccionDeAcercamiento++
                // TTC = avance sobre la trayectoria / rapidez = (dot/|v|)/|v|.
                val ttc = productoEscalar / (telemetria.velocidadMps * telemetria.velocidadMps)
                if (ttc > AlertCheckConstants.MAX_TTC_S) continue
                convergentes += Elegible(punto, distancia, ttc)
            }

            if (convergentes.isEmpty()) {
                // Había candidatos no advertidos pero ninguno alertó a tiempo:
                // si alguno convergía pero excedía TTC, domina TTC > 12 s;
                // si todos divergían (o eran perpendiculares), trayectoria divergente.
                val motivo =
                    if (enDireccionDeAcercamiento > 0) {
                        MotivoSupresion.SUPRIMIDO_TTC_MAYOR_12S
                    } else {
                        MotivoSupresion.SUPRIMIDO_TRAYECTORIA_DIVERGENTE
                    }
                return EvaluacionAlerta.Suprimida(motivo)
            }

            // --- RB-14: menor TTC; empate ⇒ menor id_punto --------------------
            val elegido =
                convergentes
                    .sortedWith(
                        compareBy<Elegible> { it.ttcS }.thenBy { it.punto.idPunto },
                    ).first()

            return EvaluacionAlerta.ConAlerta(
                alerta = elegido.punto.comoAlerta(elegido.distanciaM, elegido.ttcS),
                calculadaEnCliente = true,
            )
        }

        private fun PuntoCritico.comoAlerta(
            distanciaM: Double,
            ttcS: Double,
        ): AlertaProximidad {
            val distanciaRedondeada = (distanciaM / 10.0).toInt() * 10 // mensaje breve a golpe de vista
            // patron_sonoro (openapi AlertDetail): representación del cliente
            // para el cálculo local (CRITICO→urgente, ALTO→precaución, resto→tono corto).
            val patron =
                when (nivelRiesgo) {
                    NivelRiesgo.CRITICO -> PatronSonoro.BEEP_URGENTE
                    NivelRiesgo.ALTO -> PatronSonoro.BEEP_PRECAUCION
                    else -> PatronSonoro.TONO_CORTO
                }
            return AlertaProximidad(
                idPunto = idPunto,
                nombreInterseccion = nombreInterseccion,
                nivelRiesgo = nivelRiesgo,
                distanciaM = distanciaM,
                ttcSegundos = ttcS,
                mensajeVisual = "⚠️ Zona de riesgo a $distanciaRedondeada m: $nombreInterseccion",
                patronSonoro = patron,
                instruccionSeguridad = "Reduzca la velocidad y preste atención al cruce",
            )
        }
    }
