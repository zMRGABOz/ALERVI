package cl.alervi.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.TextoPrincipal

/**
 * Cabecera de pantalla: título con semántica de encabezado y, si corresponde,
 * botón atrás con descripción accesible (E1 §4.4). El alto es mínimo, no
 * fijo: crece con el texto ampliado del sistema.
 */
@Composable
fun CabeceraPantalla(
    titulo: String,
    modifier: Modifier = Modifier,
    onVolver: (() -> Unit)? = null,
    estiloTitulo: TextStyle = MaterialTheme.typography.headlineMedium,
) {
    val descripcionVolver = stringResource(R.string.accion_volver)
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .padding(
                        horizontal = if (onVolver != null) 8.dp else 20.dp,
                        vertical = 8.dp,
                    ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onVolver != null) {
                IconButton(onClick = onVolver) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = descripcionVolver,
                        tint = TextoPrincipal,
                    )
                }
            }
            Text(
                text = titulo,
                style = estiloTitulo,
                color = TextoPrincipal,
                modifier =
                    Modifier
                        .weight(1f)
                        .padding(start = if (onVolver != null) 4.dp else 0.dp)
                        .semantics { heading() },
            )
        }
        HorizontalDivider(color = BordeAlervi)
    }
}
