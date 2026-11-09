package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.ui.components.BotonPrimario
import cl.alervi.ui.components.BotonSecundario
import cl.alervi.ui.components.CabeceraPantalla
import cl.alervi.ui.components.EnlaceTexto
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.components.TituloSeccion
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.SuperficieAlervi
import cl.alervi.ui.theme.TealAcento
import cl.alervi.ui.theme.TealActivo
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoPrincipalSuave
import cl.alervi.ui.theme.TextoSecundario

/**
 * Pantalla 02 · Consentimiento informado (mock 02, E1 §5.3).
 *
 * El texto íntegro de la Ley 21.719 se muestra VISIBLE en la propia pantalla
 * (no oculto tras un enlace) dentro de una zona desplazable. La pantalla
 * completa se desplaza con texto ampliado (E1 §4.4).
 */
@Composable
fun ConsentimientoScreen(
    onVolver: () -> Unit,
    onAbrirPrivacidad: () -> Unit,
    onActivar: () -> Unit,
    onAhoraNo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(FondoAlervi)
                .statusBarsPadding()
                .navigationBarsPadding(),
    ) {
        CabeceraPantalla(
            titulo = stringResource(R.string.consentimiento_encabezado),
            onVolver = onVolver,
        )
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(88.dp)
                        .background(color = SuperficieAlervi, shape = CircleShape)
                        .border(width = 1.dp, color = BordeAlervi, shape = CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.LocationOn,
                    contentDescription = null,
                    tint = TealActivo,
                    modifier = Modifier.size(40.dp),
                )
            }
            Spacer(Modifier.height(20.dp))
            Text(
                text = stringResource(R.string.consentimiento_titulo),
                style = MaterialTheme.typography.headlineMedium,
                color = TextoPrincipal,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.consentimiento_intro),
                style = MaterialTheme.typography.bodyLarge,
                color = TextoPrincipalSuave,
            )
            Spacer(Modifier.height(20.dp))
            TarjetaPermiso(
                icono = Icons.Filled.LocationOn,
                titulo = stringResource(R.string.consentimiento_item_ubicacion_titulo),
                detalle = stringResource(R.string.consentimiento_item_ubicacion_detalle),
            )
            Spacer(Modifier.height(12.dp))
            TarjetaPermiso(
                icono = Icons.Filled.Warning,
                titulo = stringResource(R.string.consentimiento_item_visuales_titulo),
                detalle = stringResource(R.string.consentimiento_item_visuales_detalle),
            )
            Spacer(Modifier.height(12.dp))
            TarjetaPermiso(
                icono = Icons.Filled.Notifications,
                titulo = stringResource(R.string.consentimiento_item_sonoros_titulo),
                detalle = stringResource(R.string.consentimiento_item_sonoros_detalle),
            )
            Spacer(Modifier.height(24.dp))
            TituloSeccion(texto = stringResource(R.string.consentimiento_seccion_texto))
            Spacer(Modifier.height(12.dp))
            TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.consentimiento_texto_integro),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextoPrincipalSuave,
                    modifier = Modifier.padding(16.dp),
                )
            }
            Spacer(Modifier.height(16.dp))
            EnlaceTexto(
                texto = stringResource(R.string.consentimiento_ver_politica),
                onClick = onAbrirPrivacidad,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
            BotonPrimario(
                texto = stringResource(R.string.consentimiento_activar),
                onClick = onActivar,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            BotonSecundario(
                texto = stringResource(R.string.consentimiento_ahora_no),
                onClick = onAhoraNo,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(20.dp))
            Text(
                text = stringResource(R.string.aviso_no_manipular),
                style = MaterialTheme.typography.labelSmall,
                color = TextoSecundario,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun TarjetaPermiso(
    icono: ImageVector,
    titulo: String,
    detalle: String,
) {
    TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .background(
                            color = TealAcento.copy(alpha = 0.16f),
                            shape = CircleShape,
                        ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icono,
                    contentDescription = null,
                    tint = TealActivo,
                    modifier = Modifier.size(24.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = titulo,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextoPrincipal,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = detalle,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextoSecundario,
                )
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun ConsentimientoScreenPreview() {
    AlerviTheme {
        ConsentimientoScreen(
            onVolver = {},
            onAbrirPrivacidad = {},
            onActivar = {},
            onAhoraNo = {},
        )
    }
}
