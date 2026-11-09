package cl.alervi.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.TealAcento
import cl.alervi.ui.theme.TealClaro
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoPrincipalSuave

/**
 * CTA principal (teal #0C8882): altura mínima 56dp, radio 16dp y etiqueta
 * 17sp negrita (norma visual).
 */
@Composable
fun BotonPrimario(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = 56.dp),
        shape = RoundedCornerShape(16.dp),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = TealAcento,
                contentColor = TextoPrincipal,
            ),
    ) {
        Text(
            text = texto,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

/**
 * Acción secundaria (por ejemplo «Ahora no»): contorno neutro, misma altura
 * mínima y radio que el CTA para mantener el ritmo vertical.
 */
@Composable
fun BotonSecundario(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 56.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextoPrincipalSuave),
        border = BorderStroke(1.dp, BordeAlervi),
    ) {
        Text(
            text = texto,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

/**
 * Enlace de texto (por ejemplo «Política de privacidad»): teal claro con
 * subrayado. Objetivo táctil de al menos 48dp (E1 §4.4).
 */
@Composable
fun EnlaceTexto(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        colors = ButtonDefaults.textButtonColors(contentColor = TealClaro),
    ) {
        Text(
            text = texto,
            style = MaterialTheme.typography.bodyMedium,
            textDecoration = TextDecoration.Underline,
        )
    }
}
