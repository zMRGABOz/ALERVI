package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.ui.components.BotonPrimario
import cl.alervi.ui.components.CabeceraPantalla
import cl.alervi.ui.components.LeyendaNiveles
import cl.alervi.ui.components.MapaAlervi
import cl.alervi.ui.components.PuntoEstado
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.estado.EstadoMapa
import cl.alervi.ui.estado.EstadoMonitoreo
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.RiesgoAlto
import cl.alervi.ui.theme.TealActivo
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoSecundario

/**
 * Pantalla 03 · Mapa de puntos críticos (mock 03).
 *
 * El mapa ocupa el espacio disponible; sobre él, anclada al fondo del área
 * de mapa (sin invadir la barra inferior), una tarjeta con el estado de
 * monitoreo (RB-14), la leyenda de los 4 niveles y la atribución OSM/CARTO
 * siempre visible (REF-10/REF-11).
 *
 * Estados (E1 §11.2): Cargando, SinPuntos (TC-06, sin afirmar ausencia de
 * riesgo) y Error con reintento (TC-07).
 */
@Composable
fun MapaScreen(
    estado: EstadoMapa,
    monitoreo: EstadoMonitoreo,
    onPuntoSeleccionado: (Int) -> Unit,
    onReintentar: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val puntos = (estado as? EstadoMapa.Listo)?.puntos ?: emptyList()
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(FondoAlervi)
                .statusBarsPadding(),
    ) {
        CabeceraPantalla(
            titulo = stringResource(R.string.mapa_cabecera),
            estiloTitulo = MaterialTheme.typography.titleLarge,
        )
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            // E1 §4.4: el mapa declara su propósito y cuántos puntos muestra.
            val descripcionMapa =
                if (puntos.isEmpty()) {
                    stringResource(R.string.mapa_descripcion_sin_puntos)
                } else {
                    stringResource(R.string.mapa_descripcion_base) + " " +
                        pluralStringResource(
                            R.plurals.mapa_descripcion_puntos,
                            puntos.size,
                            puntos.size,
                        )
                }
            MapaAlervi(
                puntos = puntos,
                onPuntoSeleccionado = onPuntoSeleccionado,
                modifier =
                    Modifier
                        .fillMaxSize()
                        .semantics { contentDescription = descripcionMapa },
            )
            when (estado) {
                EstadoMapa.Cargando -> CuadroCargando()
                EstadoMapa.SinPuntos -> CuadroSinPuntos()
                EstadoMapa.Error -> CuadroError(onReintentar = onReintentar)
                is EstadoMapa.Listo -> Unit
            }
            TarjetaInformacion(
                monitoreo = monitoreo,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }
}

@Composable
private fun CuadroCargando() {
    TarjetaAlervi(modifier = Modifier.padding(24.dp)) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            CircularProgressIndicator(color = TealActivo)
            Spacer(Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.mapa_cargando),
                style = MaterialTheme.typography.titleMedium,
                color = TextoPrincipal,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun CuadroSinPuntos() {
    TarjetaAlervi(modifier = Modifier.padding(24.dp)) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.mapa_sin_puntos_titulo),
                style = MaterialTheme.typography.titleMedium,
                color = TextoPrincipal,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.mapa_sin_puntos_detalle),
                style = MaterialTheme.typography.bodySmall,
                color = TextoSecundario,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun CuadroError(onReintentar: () -> Unit) {
    TarjetaAlervi(modifier = Modifier.padding(24.dp)) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.mapa_error_titulo),
                style = MaterialTheme.typography.titleMedium,
                color = TextoPrincipal,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.mapa_error_ayuda),
                style = MaterialTheme.typography.bodySmall,
                color = TextoSecundario,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            BotonPrimario(
                texto = stringResource(R.string.reintentar),
                onClick = onReintentar,
            )
        }
    }
}

/** Estado de monitoreo (RB-14), leyenda de niveles y atribución (REF-10/11). */
@Composable
private fun TarjetaInformacion(
    monitoreo: EstadoMonitoreo,
    modifier: Modifier = Modifier,
) {
    val colorEstado =
        when (monitoreo) {
            EstadoMonitoreo.ACTIVO -> TealActivo
            EstadoMonitoreo.SIN_PERMISO -> RiesgoAlto
            EstadoMonitoreo.INACTIVO -> TextoSecundario
        }
    TarjetaAlervi(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PuntoEstado(color = colorEstado)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        text =
                            stringResource(
                                when (monitoreo) {
                                    EstadoMonitoreo.ACTIVO -> R.string.mapa_monitoreo_activo
                                    EstadoMonitoreo.SIN_PERMISO -> R.string.mapa_monitoreo_sin_permiso
                                    EstadoMonitoreo.INACTIVO -> R.string.mapa_monitoreo_inactivo
                                },
                            ),
                        style = MaterialTheme.typography.titleMedium,
                        color = TextoPrincipal,
                    )
                    Text(
                        text =
                            stringResource(
                                when (monitoreo) {
                                    EstadoMonitoreo.ACTIVO ->
                                        R.string.mapa_monitoreo_activo_detalle
                                    EstadoMonitoreo.SIN_PERMISO ->
                                        R.string.mapa_monitoreo_sin_permiso_detalle
                                    EstadoMonitoreo.INACTIVO ->
                                        R.string.mapa_monitoreo_inactivo_detalle
                                },
                            ),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextoSecundario,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = BordeAlervi)
            Spacer(Modifier.height(12.dp))
            Text(
                text = stringResource(R.string.mapa_leyenda_titulo),
                style = MaterialTheme.typography.labelMedium,
                color = TextoSecundario,
            )
            Spacer(Modifier.height(8.dp))
            LeyendaNiveles()
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = BordeAlervi)
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.atribucion_osm_carto),
                style = MaterialTheme.typography.labelSmall,
                color = TextoSecundario,
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun MapaScreenPreview() {
    AlerviTheme {
        MapaScreen(
            estado = EstadoMapa.Listo(puntosEjemplo()),
            monitoreo = EstadoMonitoreo.ACTIVO,
            onPuntoSeleccionado = {},
            onReintentar = {},
        )
    }
}

/** Datos de ejemplo solo para @Preview (en la app provienen del repositorio). */
private fun puntosEjemplo(): List<PuntoCritico> =
    listOf(
        PuntoCritico(
            idPunto = 41,
            longitud = -73.0444,
            latitud = -36.8201,
            nombreInterseccion = "Av. Arturo Prat con Chacabuco",
            comuna = "Concepción",
            nivelRiesgo = NivelRiesgo.CRITICO,
            indicePrioridad = 87.4,
            totalSiniestros = 214,
        ),
        PuntoCritico(
            idPunto = 12,
            longitud = -73.0501,
            latitud = -36.8270,
            nombreInterseccion = "Collao con Chacabuco",
            comuna = "Concepción",
            nivelRiesgo = NivelRiesgo.ALTO,
            indicePrioridad = 71.0,
            totalSiniestros = 96,
        ),
    )
