package cl.alervi.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.colorDeNivel

/**
 * Chip de nivel de riesgo (pantalla 04): fondo con el color del nivel y
 * etiqueta textual «Riesgo {nivel}».
 *
 * E1 §4.4: el nivel NUNCA se comunica solo por color; el texto oscuro sobre
 * el color de riesgo mantiene un contraste ≥ 4,9:1 en los cuatro niveles.
 */
@Composable
fun ChipNivelRiesgo(
    nivel: NivelRiesgo,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(percent = 50),
        color = colorDeNivel(nivel),
    ) {
        Text(
            text = stringResource(R.string.chip_riesgo_formato, nivel.etiqueta),
            style = MaterialTheme.typography.labelMedium,
            color = FondoAlervi,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
        )
    }
}
