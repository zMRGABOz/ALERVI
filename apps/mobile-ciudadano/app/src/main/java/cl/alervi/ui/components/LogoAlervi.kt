package cl.alervi.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.RiesgoCritico

/**
 * Logo de ALERVI (pantalla 01) dibujado en Canvas: pin de mapa rojo #EF4058
 * con la letra «A» en tono oscuro. Sin assets binarios ni dependencias
 * (RD-01); la descripción accesible la aporta quien lo usa (E1 §4.4).
 */
@Composable
fun LogoAlervi(
    contentDescription: String,
    modifier: Modifier = Modifier,
    colorPin: Color = RiesgoCritico,
    colorLetra: Color = FondoAlervi,
) {
    Canvas(
        modifier = modifier.semantics { this.contentDescription = contentDescription },
    ) {
        val ancho = size.width
        val alto = size.height

        // Pin: arco superior (270° visibles) con cola hacia la punta inferior.
        val radio = ancho * 0.36f
        val cx = ancho / 2f
        val cy = radio * 1.08f
        val puntaY = alto * 0.98f

        val pin =
            Path().apply {
                // Arco desde 150° (abajo-izquierda) hasta 50° (abajo-derecha).
                arcTo(
                    Rect(cx - radio, cy - radio, cx + radio, cy + radio),
                    150f,
                    260f,
                    true,
                )
                // Cola derecha: del fin del arco a la punta.
                quadraticTo(
                    cx + radio * 0.58f,
                    cy + radio * 1.10f,
                    cx,
                    puntaY,
                )
                // Cola izquierda: de la punta al inicio del arco.
                quadraticTo(
                    cx - radio * 0.58f,
                    cy + radio * 1.10f,
                    cx - radio * 0.643f,
                    cy + radio * 0.766f,
                )
                close()
            }
        drawPath(path = pin, color = colorPin)

        // Letra «A» geométrica con trazos redondeados.
        val grosor = radio * 0.26f
        val apice = Offset(cx, cy - radio * 0.52f)
        val baseIzquierda = Offset(cx - radio * 0.46f, cy + radio * 0.42f)
        val baseDerecha = Offset(cx + radio * 0.46f, cy + radio * 0.42f)
        val cruceIzquierda = Offset(cx - radio * 0.27f, cy + radio * 0.02f)
        val cruceDerecha = Offset(cx + radio * 0.27f, cy + radio * 0.02f)

        drawLine(colorLetra, baseIzquierda, apice, strokeWidth = grosor, cap = StrokeCap.Round)
        drawLine(colorLetra, baseDerecha, apice, strokeWidth = grosor, cap = StrokeCap.Round)
        drawLine(
            colorLetra,
            cruceIzquierda,
            cruceDerecha,
            strokeWidth = grosor * 0.9f,
            cap = StrokeCap.Round,
        )
    }
}
