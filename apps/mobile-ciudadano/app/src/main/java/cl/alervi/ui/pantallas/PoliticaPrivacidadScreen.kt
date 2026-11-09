package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.ui.components.CabeceraPantalla
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.TextoPrincipalSuave

/**
 * Pantalla de política de privacidad (E1 §5.3: accesible desde Bienvenida,
 * Consentimiento y Configuración). Texto íntegro en columna desplazable para
 * que el texto ampliado no se recorte (E1 §4.4).
 */
@Composable
fun PoliticaPrivacidadScreen(
    onVolver: () -> Unit,
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
            titulo = stringResource(R.string.privacidad_titulo),
            onVolver = onVolver,
        )
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
        ) {
            TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.privacidad_texto),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextoPrincipalSuave,
                    modifier = Modifier.padding(20.dp),
                )
            }
        }
    }
}
