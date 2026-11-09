package cl.alervi.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import cl.alervi.R
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.OrigenDetalle
import cl.alervi.domain.model.Tendencia
import cl.alervi.ui.components.BotonPrimario
import cl.alervi.ui.components.CabeceraPantalla
import cl.alervi.ui.components.ChipNivelRiesgo
import cl.alervi.ui.components.MiniMapaAlervi
import cl.alervi.ui.components.TarjetaAlervi
import cl.alervi.ui.components.TituloSeccion
import cl.alervi.ui.estado.EstadoDetalle
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.FondoAlervi
import cl.alervi.ui.theme.RiesgoAlto
import cl.alervi.ui.theme.TealActivo
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoPrincipalSuave
import cl.alervi.ui.theme.TextoSecundario
import cl.alervi.ui.util.Formato

/** Marco del aviso de procedencia y de la advertencia legal (RB-6). */
private val FormaAviso = RoundedCornerShape(16.dp)

/**
 * Pantalla 04 · Detalle de punto crítico (mock 04).
 *
 * Mini mapa de ubicación (altura fija ~200dp) y superficie desplazable con
 * nombre, chip de nivel, índice de prioridad (RB-5), antecedentes históricos
 * con período (RB-2), aviso de procedencia cuando el detalle proviene del
 * respaldo del listado y advertencia legal al pie (RB-6).
 *
 * Los datos incompletos se muestran como «No disponible» y NUNCA se
 * interpretan como ausencia de siniestros (RB-2).
 */
@Composable
fun DetalleScreen(
    estado: EstadoDetalle,
    onVolver: () -> Unit,
    onReintentar: () -> Unit,
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
            titulo = stringResource(R.string.detalle_cabecera),
            onVolver = onVolver,
        )
        when (estado) {
            EstadoDetalle.Cargando ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = TealActivo)
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = stringResource(R.string.detalle_cargando),
                            style = MaterialTheme.typography.titleMedium,
                            color = TextoPrincipal,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

            EstadoDetalle.Error ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    TarjetaAlervi(modifier = Modifier.padding(24.dp)) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = stringResource(R.string.detalle_error_titulo),
                                style = MaterialTheme.typography.titleMedium,
                                color = TextoPrincipal,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = stringResource(R.string.detalle_error_ayuda),
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

            is EstadoDetalle.Listo -> ContenidoDetalle(detalle = estado.detalle)
        }
    }
}

@Composable
private fun ContenidoDetalle(
    detalle: DetallePuntoCritico,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        MiniMapaAlervi(
            latitud = detalle.latitud,
            longitud = detalle.longitud,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(200.dp),
        )
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
        ) {
            Text(
                text = detalle.nombreInterseccion,
                style = MaterialTheme.typography.headlineMedium,
                color = TextoPrincipal,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = detalle.comuna,
                style = MaterialTheme.typography.bodyMedium,
                color = TextoSecundario,
            )
            Spacer(Modifier.height(12.dp))
            ChipNivelRiesgo(nivel = detalle.nivelRiesgo)
            Spacer(Modifier.height(20.dp))
            Text(
                text = stringResource(R.string.detalle_indice_titulo),
                style = MaterialTheme.typography.labelMedium,
                color = TextoSecundario,
            )
            Spacer(Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = Formato.indice(detalle.indicePrioridad),
                    style = MaterialTheme.typography.headlineMedium,
                    color = TextoPrincipal,
                    modifier = Modifier.alignByBaseline(),
                )
                Text(
                    text = stringResource(R.string.detalle_indice_sobre_cien),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextoSecundario,
                    modifier =
                        Modifier
                            .padding(start = 6.dp)
                            .alignByBaseline(),
                )
            }
            Spacer(Modifier.height(24.dp))
            TituloSeccion(texto = stringResource(R.string.detalle_seccion_antecedentes))
            Spacer(Modifier.height(12.dp))
            TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    FilaDato(
                        etiqueta = stringResource(R.string.detalle_rotulo_siniestros),
                        valor = Formato.entero(detalle.totalSiniestros),
                    )
                    FilaDato(
                        etiqueta = stringResource(R.string.detalle_rotulo_fallecidos),
                        valor = detalle.totalFallecidos?.let { Formato.entero(it) },
                    )
                    FilaDato(
                        etiqueta = stringResource(R.string.detalle_rotulo_graves),
                        valor = detalle.totalGraves?.let { Formato.entero(it) },
                    )
                    FilaDato(
                        etiqueta = stringResource(R.string.detalle_rotulo_tendencia),
                        valor = tendencia(detalle.tendencia),
                    )
                    FilaDato(
                        etiqueta = stringResource(R.string.detalle_rotulo_periodo),
                        valor = detalle.periodoDatos,
                        textoNoDisponible = stringResource(R.string.detalle_periodo_no_disponible),
                    )
                }
            }
            detalle.explicacionCiudadana?.let { explicacion ->
                Spacer(Modifier.height(24.dp))
                TituloSeccion(texto = stringResource(R.string.detalle_seccion_explicacion))
                Spacer(Modifier.height(12.dp))
                TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = explicacion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextoPrincipalSuave,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            if (detalle.origen == OrigenDetalle.RESPALDO_LISTA) {
                Spacer(Modifier.height(16.dp))
                TarjetaAlervi(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Info,
                            contentDescription = null,
                            tint = RiesgoAlto,
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = stringResource(R.string.detalle_aviso_respaldo),
                            style = MaterialTheme.typography.bodySmall,
                            color = TextoPrincipalSuave,
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(color = FondoAlervi, shape = FormaAviso)
                        .border(width = 1.dp, color = BordeAlervi, shape = FormaAviso),
            ) {
                Text(
                    text = detalle.advertenciaLegal,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextoSecundario,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
    }
}

/**
 * Fila etiqueta–valor de los antecedentes. Cuando el dato es null se muestra
 * «No disponible»: un dato incompleto jamás se presenta como ausencia de
 * siniestros (RB-2).
 */
@Composable
private fun FilaDato(
    etiqueta: String,
    valor: String?,
    textoNoDisponible: String = stringResource(R.string.detalle_dato_no_disponible),
) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = etiqueta,
            style = MaterialTheme.typography.bodyMedium,
            color = TextoSecundario,
            modifier = Modifier.weight(1f),
        )
        if (valor != null) {
            Text(
                text = valor,
                style = MaterialTheme.typography.titleMedium,
                color = TextoPrincipal,
            )
        } else {
            Text(
                text = textoNoDisponible,
                style = MaterialTheme.typography.bodyMedium,
                color = TextoSecundario,
            )
        }
    }
}

@Composable
private fun tendencia(raw: String?): String? =
    when (Tendencia.desdeValor(raw)) {
        Tendencia.ALZA -> stringResource(R.string.tendencia_al_alza)
        Tendencia.ESTABLE -> stringResource(R.string.tendencia_estable)
        Tendencia.BAJA -> stringResource(R.string.tendencia_a_la_baja)
        null -> null
    }

@Preview(showBackground = true, backgroundColor = 0xFF101216)
@Composable
private fun DetalleScreenPreview() {
    AlerviTheme {
        DetalleScreen(
            estado = EstadoDetalle.Listo(detalleEjemplo()),
            onVolver = {},
            onReintentar = {},
        )
    }
}

/** Datos de ejemplo solo para @Preview (en la app provienen del repositorio). */
@Composable
private fun detalleEjemplo(): DetallePuntoCritico =
    DetallePuntoCritico(
        idPunto = 41,
        nombreInterseccion = "Av. Arturo Prat con Chacabuco",
        comuna = "Concepción",
        latitud = -36.8201,
        longitud = -73.0444,
        nivelRiesgo = NivelRiesgo.CRITICO,
        indicePrioridad = 87.4,
        totalSiniestros = 214,
        totalFallecidos = 9,
        totalGraves = 31,
        totalLeves = 120,
        tendencia = "ALZA",
        periodoDatos = "2019–2023",
        colegioCercanoM = 140,
        paraderoCercanoM = 60,
        explicacionCiudadana =
            "Intersección con alta demanda de giro y cruce peatonal junto a un colegio.",
        advertenciaLegal = stringResource(R.string.aviso_rb6),
        origen = OrigenDetalle.RESPALDO_LISTA,
    )
