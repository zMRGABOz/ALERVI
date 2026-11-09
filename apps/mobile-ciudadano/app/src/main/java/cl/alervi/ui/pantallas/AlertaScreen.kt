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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cl.alervi.R
import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PatronSonoro
import cl.alervi.ui.components.BotonPrimario
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.RiesgoAlto
import cl.alervi.ui.theme.RiesgoCritico
import cl.alervi.ui.theme.SuperficieAlervi
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoPrincipalSuave
import cl.alervi.ui.theme.TextoSecundario

/**
 * Pantalla 05 · Alerta de proximidad (mock 05).
 *
 * Superficie de pantalla completa sobre el mapa: el mensaje se lee SIN
 * interacción (RD-04, RNF-U-4). Sin botón de simulación ni etiqueta
 * «simulada». Permanece inactiva hasta que la telemetría la dispare; se
 * entrega con @Preview.
 *
 * El bloque central se desplaza si el texto ampliado lo requiere; el CTA y
 * los avisos de pie permanecen visibles.
 */
@Composable
fun AlertaScreen(
    alerta: AlertaProximidad,
    onVolverAlMapa: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxSize(),
        color = FondoAlervi,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
        ) {
            // Barra superior naranja (mock 05), decorativa.
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(RiesgoAlto),
            )
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
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(104.dp)
                                .background(color = SuperficieAlervi, shape = CircleShape)
                                .border(width = 1.dp, color = BordeAlervi, shape = CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        // Signo decorativo: el rótulo «PRECAUCIÓN» ya transmite
                        // el significado, por eso se oculta a TalkBack (E1 §4.4).
                        Text(
                            text = stringResource(R.string.alerta_signo),
                            color = RiesgoCritico,
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clearAndSetSemantics { },
                        )
                    }
                    Spacer(Modifier.height(24.dp))
                    Text(
                        text = stringResource(R.string.alerta_rotulo),
                        style = MaterialTheme.typography.titleLarge.copy(letterSpacing = 4.sp),
                        color = RiesgoCritico,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { heading() },
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = alerta.mensajeVisual,
                        style = MaterialTheme.typography.headlineMedium,
                        color = TextoPrincipal,
                        textAlign = TextAlign.Center,
                        // RNF-U-4/E1 §4.4: el aviso se anuncia a TalkBack en
                        // cuanto aparece, sin exigir interacción (RD-04).
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = alerta.nombreInterseccion,
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextoSecundario,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text =
                            alerta.instruccionSeguridad
                                ?: stringResource(R.string.alerta_instruccion_predeterminada),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextoPrincipalSuave,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 24.dp, end = 24.dp, bottom = 16.dp),
            ) {
                BotonPrimario(
                    texto = stringResource(R.string.alerta_volver_al_mapa),
                    onClick = onVolverAlMapa,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(14.dp))
                Text(
                    text = stringResource(R.string.aviso_ausencia_alerta),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextoSecundario,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.aviso_no_manipular),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextoSecundario,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun AlertaScreenPreview() {
    AlerviTheme {
        AlertaScreen(
            // Datos de ejemplo solo para @Preview: en la app la alerta la
            // produce la evaluación de telemetría, no la UI.
            alerta =
                AlertaProximidad(
                    idPunto = 41,
                    nombreInterseccion = "Av. Arturo Prat con Chacabuco",
                    nivelRiesgo = NivelRiesgo.CRITICO,
                    distanciaM = 180.0,
                    ttcSegundos = 9.0,
                    mensajeVisual = "Te acercas a un punto crítico de siniestralidad vial",
                    patronSonoro = PatronSonoro.BEEP_URGENTE,
                    instruccionSeguridad =
                        "Reduce la velocidad y aumenta la distancia con el vehículo que va adelante.",
                ),
            onVolverAlMapa = {},
        )
    }
}
