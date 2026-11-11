package cl.alervi.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.ui.theme.TextoPrincipalSuave
import cl.alervi.ui.theme.colorDeNivel

/**
 * Leyenda de los 4 niveles de riesgo (pantalla 03): color + etiqueta textual
 * de `NivelRiesgo.etiqueta` (E1 §4.4: nunca solo color).
 *
 * FlowRow: con texto ampliado los ítems pasan a una segunda línea en vez de
 * recortarse (E1 §4.4).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LeyendaNiveles(
    modifier: Modifier = Modifier,
) {
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(space = 14.dp),
        verticalArrangement = Arrangement.spacedBy(space = 6.dp),
    ) {
        NivelRiesgo.entries.forEach { nivel ->
            ItemLeyenda(
                color = colorDeNivel(nivel),
                etiqueta = nivel.etiqueta,
            )
        }
    }
}

@Composable
private fun ItemLeyenda(
    color: Color,
    etiqueta: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier =
                Modifier
                    .size(10.dp)
                    .background(color = color, shape = CircleShape),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = etiqueta,
            style = MaterialTheme.typography.labelMedium,
            color = TextoPrincipalSuave,
        )
    }
}
