package cl.alervi.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * Tema Material 3 de ALERVI. Soporta modo claro/oscuro del sistema.
 * El escalado de texto respeta los ajustes del sistema (§4.4 accesibilidad,
 * texto ampliado); no se fijan tamaños en dp para tipografía.
 */
private val EsquemaClaro =
    lightColorScheme(
        primary = Primario,
        secondary = Secundario,
        background = Fondo,
        surface = Superficie,
    )

private val EsquemaOscuro =
    darkColorScheme(
        primary = PrimarioOscuro,
        secondary = Secundario,
    )

@Composable
fun AlerviTheme(
    contenidoOscuro: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (contenidoOscuro) EsquemaOscuro else EsquemaClaro,
        typography = TipografiaAlervi,
        content = content,
    )
}
