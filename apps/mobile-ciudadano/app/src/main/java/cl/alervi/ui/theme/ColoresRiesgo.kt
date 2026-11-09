package cl.alervi.ui.theme

import androidx.compose.ui.graphics.Color
import cl.alervi.domain.model.NivelRiesgo

/**
 * Color del nivel de riesgo para chip, leyenda y tarjetas.
 *
 * E1 §4.4 (accesibilidad): el color NUNCA es el único canal; siempre acompaña
 * a la etiqueta textual de `NivelRiesgo.etiqueta`.
 */
fun colorDeNivel(nivel: NivelRiesgo): Color =
    when (nivel) {
        NivelRiesgo.CRITICO -> RiesgoCritico
        NivelRiesgo.ALTO -> RiesgoAlto
        NivelRiesgo.MEDIO -> RiesgoMedio
        NivelRiesgo.BAJO -> RiesgoBajo
    }
