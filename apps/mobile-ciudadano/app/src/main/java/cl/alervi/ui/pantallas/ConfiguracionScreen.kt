package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.ui.components.CabeceraPantalla
import cl.alervi.ui.components.PuntoEstado
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.components.TituloSeccion
import cl.alervi.ui.estado.EstadoConfiguracion
import cl.alervi.ui.estado.EstadoPermisoUbicacion
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.RiesgoCritico
import cl.alervi.ui.theme.TealActivo
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoSecundario
import cl.alervi.ui.util.Formato

/**
 * Pantalla 06 · Configuración (mock 06).
 *
 * Estado del sistema según el permiso de ubicación (TC-27: sin prometer
 * monitoreo cuando falta el permiso; RB-1 piloto Concepción; RB-14 sesión),
 * un ÚNICO switch maestro de alertas (sin switches
 * separados visual/sonoro), fecha del consentimiento registrado (§5.3),
 * acceso a la política de privacidad y «Sobre ALERVI» (RB-6).
 */
@Composable
fun ConfiguracionScreen(
    estado: EstadoConfiguracion,
    onAlternarAlertas: (Boolean) -> Unit,
    onAbrirPrivacidad: () -> Unit,
    onVolver: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(FondoAlervi)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            titulo = stringResource(R.string.configuracion_cabecera),
            onVolver = onVolver,
        )
        Column(modifier = Modifier.padding(20.dp)) {
            TituloSeccion(texto = stringResource(R.string.configuracion_seccion_estado))
            Spacer(Modifier.height(12.dp))
            TarjetaEstadoSistema(estado = estado)
            Spacer(Modifier.height(24.dp))
            TituloSeccion(texto = stringResource(R.string.configuracion_seccion_preferencias))
            Spacer(Modifier.height(12.dp))
            TarjetaPreferencias(
                estado = estado,
                onAlternarAlertas = onAlternarAlertas,
            )
            Spacer(Modifier.height(24.dp))
            FilaEnlacePrivacidad(onAbrirPrivacidad = onAbrirPrivacidad)
            Spacer(Modifier.height(24.dp))
            TituloSeccion(texto = stringResource(R.string.configuracion_seccion_sobre))
            Spacer(Modifier.height(12.dp))
            TarjetaSobreAlervi()
        }
    }
}

/**
 * Estado del sistema. Nunca se afirma monitoreo si el permiso falta (TC-27);
 * la sesión solo se declara activa cuando lo está (RB-14).
 */
@Composable
private fun TarjetaEstadoSistema(estado: EstadoConfiguracion) {
    val (colorPunto, titulo, lineas) =
        when (estado.permiso) {
            EstadoPermisoUbicacion.CONCEDIDO ->
                Triple(
                    TealActivo,
                    stringResource(R.string.configuracion_ubicacion_concedida),
                    listOf(
                        stringResource(R.string.configuracion_piloto),
                        stringResource(
                            if (estado.alertasActivas) {
                                R.string.configuracion_sesion_activa
                            } else {
                                R.string.configuracion_sesion_inactiva
                            },
                        ),
                    ),
                )

            EstadoPermisoUbicacion.NO_SOLICITADO ->
                Triple(
                    TextoSecundario,
                    stringResource(R.string.configuracion_ubicacion_no_solicitada),
                    listOf(
                        stringResource(R.string.configuracion_ubicacion_no_solicitada_detalle),
                    ),
                )

            EstadoPermisoUbicacion.DENEGADO ->
                Triple(
                    RiesgoCritico,
                    stringResource(R.string.configuracion_ubicacion_denegada),
                    listOf(
                        stringResource(R.string.configuracion_ubicacion_denegada_detalle),
                        stringResource(R.string.configuracion_piloto),
                    ),
                )
        }
    TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PuntoEstado(color = colorPunto, tamano = 12.dp)
                Spacer(Modifier.width(10.dp))
                Text(
                    text = titulo,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextoPrincipal,
                )
            }
            lineas.forEach { linea ->
                Text(
                    text = linea,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextoSecundario,
                    modifier = Modifier.padding(start = 22.dp),
                )
            }
        }
    }
}

/**
 * Switch maestro de alertas (RB-14). La fila completa es el control: etiqueta
 * textual + rol de interruptor + estado anunciado (E1 §4.4).
 */
@Composable
private fun TarjetaPreferencias(
    estado: EstadoConfiguracion,
    onAlternarAlertas: (Boolean) -> Unit,
) {
    TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .toggleable(
                            value = estado.alertasActivas,
                            role = Role.Switch,
                            onValueChange = onAlternarAlertas,
                        )
                        .heightIn(min = 56.dp)
                        .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.configuracion_alertas_titulo),
                        style = MaterialTheme.typography.titleMedium,
                        color = TextoPrincipal,
                    )
                    Text(
                        text = stringResource(R.string.configuracion_alertas_detalle),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextoSecundario,
                    )
                }
                Spacer(Modifier.width(16.dp))
                Switch(
                    checked = estado.alertasActivas,
                    onCheckedChange = null,
                )
            }
            estado.consentimiento?.let { consentimiento ->
                HorizontalDivider(
                    color = BordeAlervi,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = TealActivo,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text =
                            stringResource(
                                R.string.configuracion_consentimiento_formato,
                                Formato.fechaHora(consentimiento.fechaMs),
                            ),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextoSecundario,
                    )
                }
            }
        }
    }
}

@Composable
private fun FilaEnlacePrivacidad(onAbrirPrivacidad: () -> Unit) {
    TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .clickable(role = Role.Button, onClick = onAbrirPrivacidad)
                    .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.configuracion_privacidad),
                style = MaterialTheme.typography.titleMedium,
                color = TextoPrincipal,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = TextoSecundario,
            )
        }
    }
}

/** «Sobre ALERVI»: carácter relativo del índice (RB-6) y aviso de ausencia. */
@Composable
private fun TarjetaSobreAlervi() {
    TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.aviso_rb6),
                style = MaterialTheme.typography.bodySmall,
                color = TextoSecundario,
            )
            HorizontalDivider(color = BordeAlervi)
            Text(
                text = stringResource(R.string.aviso_ausencia_alerta),
                style = MaterialTheme.typography.bodySmall,
                color = TextoSecundario,
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun ConfiguracionScreenPreview() {
    AlerviTheme {
        ConfiguracionScreen(
            estado =
                EstadoConfiguracion(
                    permiso = EstadoPermisoUbicacion.CONCEDIDO,
                    alertasActivas = true,
                    consentimiento =
                        RegistroConsentimiento.Consentimiento(
                            versionTexto = RegistroConsentimiento.VERSION_TEXTO_ACTUAL,
                            fechaMs = 1_762_300_000_000L,
                        ),
                ),
            onAlternarAlertas = {},
            onAbrirPrivacidad = {},
            onVolver = {},
        )
    }
}
