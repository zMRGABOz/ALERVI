package cl.alervi.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Punto de estado (monitoreo del mapa, permiso de ubicación). Es decorativo:
 * el significado lo lleva siempre el texto que lo acompaña (E1 §4.4).
 */
@Composable
fun PuntoEstado(
    color: Color,
    modifier: Modifier = Modifier,
    tamano: Dp = 10.dp,
) {
    Box(
        modifier =
            modifier
                .size(tamano)
                .background(color = color, shape = CircleShape),
    )
}
