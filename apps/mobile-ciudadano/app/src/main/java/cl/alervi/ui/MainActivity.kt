package cl.alervi.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.BuildConfig
import cl.alervi.R
import cl.alervi.ui.theme.AlerviTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Actividad principal (RF-2: consulta pública sin cuenta ni autenticación).
 *
 * Pantalla de verificación de compilación. Las pantallas
 * definitivas (Bienvenida, Consentimiento, Mapa, Detalle, Estado) se implementan en
 * la interfaz conforme a los mockups.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AlerviTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    PantallaAndamiaje()
                }
            }
        }
    }
}

@Composable
private fun PantallaAndamiaje() {
    val descripcion = stringResource(R.string.pantalla_andamiaje_descripcion)
    Scaffold(modifier = Modifier.semantics { contentDescription = descripcion }) { innerPadding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.headlineMedium,
            )
            Text(
                text = stringResource(R.string.pantalla_andamiaje_mensaje),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text =
                    if (BuildConfig.MODO_SIN_RED) {
                        stringResource(R.string.entorno_mock)
                    } else {
                        stringResource(R.string.entorno_local)
                    },
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun PantallaAndamiajePreview() {
    AlerviTheme {
        PantallaAndamiaje()
    }
}
