package cl.alervi.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import cl.alervi.ui.theme.TextoPrincipal

/**
 * Título de sección (~20sp negrita) con semántica de encabezado para la
 * navegación por encabezados de TalkBack (E1 §4.4).
 */
@Composable
fun TituloSeccion(
    texto: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = texto,
        style = MaterialTheme.typography.titleLarge,
        color = TextoPrincipal,
        modifier = modifier.semantics { heading() },
    )
}
