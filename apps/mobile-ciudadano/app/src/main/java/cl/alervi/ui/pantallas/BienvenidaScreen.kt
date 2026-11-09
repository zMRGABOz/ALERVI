package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.BuildConfig
import cl.alervi.R
import cl.alervi.ui.components.BotonPrimario
import cl.alervi.ui.components.EnlaceTexto
import cl.alervi.ui.components.LogoAlervi
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.TealClaro
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoPrincipalSuave
import cl.alervi.ui.theme.TextoSecundario

/** Recuadro neutro de la propuesta de valor (mock 01). */
private val FormaRecuadro = RoundedCornerShape(20.dp)

/**
 * Pantalla 01 · Bienvenida (mock 01).
 *
 * Marca, propuesta de valor y CTA «Comenzar». El pie «Prototipo
 * demostrativo» solo se muestra en el flavor mock (BuildConfig.MODO_SIN_RED);
 * nunca en `local`.
 *
 * El contenido se centra cuando cabe y se desplaza cuando el texto ampliado
 * lo hace crecer (E1 §4.4).
 */
@Composable
fun BienvenidaScreen(
    onComenzar: () -> Unit,
    onAbrirPrivacidad: () -> Unit,
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
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier =
                    Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                LogoAlervi(
                    contentDescription = stringResource(R.string.bienvenida_logo_descripcion),
                    modifier = Modifier.size(width = 128.dp, height = 150.dp),
                )
                Spacer(Modifier.height(24.dp))
                Text(
                    text = stringResource(R.string.app_name),
                    style = MaterialTheme.typography.displaySmall,
                    color = TextoPrincipal,
                )
                Spacer(Modifier.height(24.dp))
                TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = stringResource(R.string.bienvenida_propuesta_titulo),
                            style = MaterialTheme.typography.titleLarge,
                            color = TealClaro,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = stringResource(R.string.bienvenida_propuesta_cuerpo),
                            style = MaterialTheme.typography.bodyLarge,
                            color = TextoPrincipalSuave,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(color = FondoAlervi, shape = FormaRecuadro)
                            .border(width = 1.dp, color = BordeAlervi, shape = FormaRecuadro),
                ) {
                    Text(
                        text = stringResource(R.string.bienvenida_recuadro),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextoSecundario,
                        textAlign = TextAlign.Center,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                    )
                }
                Spacer(Modifier.height(28.dp))
                BotonPrimario(
                    texto = stringResource(R.string.bienvenida_comenzar),
                    onClick = onComenzar,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                EnlaceTexto(
                    texto = stringResource(R.string.bienvenida_privacidad),
                    onClick = onAbrirPrivacidad,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        if (BuildConfig.MODO_SIN_RED) {
            Text(
                text = stringResource(R.string.bienvenida_pie_prototipo),
                style = MaterialTheme.typography.labelSmall,
                color = TextoSecundario,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun BienvenidaScreenPreview() {
    AlerviTheme {
        BienvenidaScreen(
            onComenzar = {},
            onAbrirPrivacidad = {},
        )
    }
}
