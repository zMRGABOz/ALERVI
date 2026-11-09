package cl.alervi.ui.navigation

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cl.alervi.ui.components.AlerviBarraInferior
import cl.alervi.ui.estado.EstadoConfiguracion
import cl.alervi.ui.estado.EstadoMonitoreo
import cl.alervi.ui.estado.EstadoPermisoUbicacion
import cl.alervi.ui.estado.PestanaAlervi
import cl.alervi.ui.pantallas.AlertaScreen
import cl.alervi.ui.pantallas.BienvenidaScreen
import cl.alervi.ui.pantallas.ConfiguracionScreen
import cl.alervi.ui.pantallas.ConsentimientoScreen
import cl.alervi.ui.pantallas.DetalleScreen
import cl.alervi.ui.pantallas.MapaScreen
import cl.alervi.ui.pantallas.PoliticaPrivacidadScreen
import cl.alervi.ui.theme.AlerviTheme
import cl.alervi.ui.viewmodel.AppViewModel
import cl.alervi.ui.viewmodel.DetalleViewModel
import cl.alervi.ui.viewmodel.MapaViewModel

/**
 * Raíz de la app ciudadana.
 *
 * Responsabilidades de integración (no visuales):
 *  - Decidir el destino inicial según el consentimiento registrado (§5.3).
 *  - Orquestar el permiso de ubicación DESPUÉS de la acción afirmativa.
 *  - Conectar ViewModels con pantallas puras.
 *  - Mostrar la alerta visual por encima de la navegación (RD-04).
 */
@Composable
fun AlerviRoot() {
    AlerviTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
            val appVm: AppViewModel = hiltViewModel()
            val consentimiento by appVm.consentimiento.collectAsStateWithLifecycle()
            val cargado by appVm.consentimientoCargado.collectAsStateWithLifecycle()

            if (!cargado) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else {
                ContenidoApp(appVm = appVm, inicioEnMapa = consentimiento != null)
            }
        }
    }
}

@Composable
private fun ContenidoApp(
    appVm: AppViewModel,
    inicioEnMapa: Boolean,
) {
    val navegador = rememberNavController()
    val contexto = LocalContext.current

    val consentimiento by appVm.consentimiento.collectAsStateWithLifecycle()
    val permiso by appVm.permisoUbicacion.collectAsStateWithLifecycle()
    val alertasActivas by appVm.alertasActivas.collectAsStateWithLifecycle()
    val alerta by appVm.alertaActual.collectAsStateWithLifecycle()

    // Estado real del permiso al abrir o retomar la app (TC-27): no se vuelve a
    // pedir solo. Al reanudar también se detecta una revocación en Ajustes.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        appVm.sincronizarPermiso()
    }

    // Ubicación + (Android 13+) notificaciones: la alerta visual debe poder
    // mostrarse con la pantalla bloqueada y el servicio en primer plano.
    val permisosSolicitados =
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.toTypedArray()

    val lanzadorPermiso =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestMultiplePermissions(),
        ) { resultados ->
            val ubicacionConcedida =
                resultados[Manifest.permission.ACCESS_FINE_LOCATION] == true
            appVm.actualizarPermiso(ubicacionConcedida)
        }

    val pedirPermiso: () -> Unit = {
        lanzadorPermiso.launch(permisosSolicitados)
    }

    val entradaActual by navegador.currentBackStackEntryAsState()
    val rutaActual = entradaActual?.destination?.route
    val mostrandoAjustes = rutaActual == Rutas.CONFIGURACION
    val mostrarBarra = rutaActual == Rutas.MAPA || mostrandoAjustes

    // TC-27: sin permiso no se afirma monitoreo, aunque el consentimiento exista.
    val monitoreo =
        when {
            !alertasActivas -> EstadoMonitoreo.INACTIVO
            permiso == EstadoPermisoUbicacion.CONCEDIDO -> EstadoMonitoreo.ACTIVO
            else -> EstadoMonitoreo.SIN_PERMISO
        }

    // La alerta visual cubre TODA la pantalla, incluida la barra inferior
    // (RD-04): por eso vive fuera del padding del Scaffold.
    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            bottomBar = {
                if (mostrarBarra) {
                    AlerviBarraInferior(
                        pestanaActual = if (mostrandoAjustes) PestanaAlervi.AJUSTES else PestanaAlervi.MAPA,
                        onMapa = {
                            if (rutaActual != Rutas.MAPA) {
                                navegador.navigate(Rutas.MAPA) {
                                    launchSingleTop = true
                                    popUpTo(Rutas.MAPA) { inclusive = false }
                                }
                            }
                        },
                        onAjustes = {
                            if (!mostrandoAjustes) {
                                navegador.navigate(Rutas.CONFIGURACION) { launchSingleTop = true }
                            }
                        },
                    )
                }
            },
        ) { relleno ->
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(relleno),
            ) {
                NavHost(
                    navController = navegador,
                    startDestination = if (inicioEnMapa) Rutas.MAPA else Rutas.BIENVENIDA,
                ) {
                    composable(Rutas.BIENVENIDA) {
                        BienvenidaScreen(
                            onComenzar = { navegador.navigate(Rutas.CONSENTIMIENTO) },
                            onAbrirPrivacidad = { navegador.navigate(Rutas.PRIVACIDAD) },
                        )
                    }

                    composable(Rutas.CONSENTIMIENTO) {
                        ConsentimientoScreen(
                            onVolver = { navegador.popBackStack() },
                            onAbrirPrivacidad = { navegador.navigate(Rutas.PRIVACIDAD) },
                            onActivar = {
                                // §5.3: primero la acción afirmativa (versión + fecha),
                                // después el permiso del sistema operativo.
                                appVm.activarAlertas()
                                pedirPermiso()
                                navegador.navigate(Rutas.MAPA) {
                                    popUpTo(Rutas.BIENVENIDA) { inclusive = true }
                                    launchSingleTop = true
                                }
                            },
                            onAhoraNo = {
                                navegador.navigate(Rutas.MAPA) {
                                    popUpTo(Rutas.BIENVENIDA) { inclusive = true }
                                    launchSingleTop = true
                                }
                            },
                        )
                    }

                    composable(Rutas.MAPA) {
                        val mapaVm: MapaViewModel = hiltViewModel()
                        val estadoMapa by mapaVm.estado.collectAsStateWithLifecycle()
                        MapaScreen(
                            estado = estadoMapa,
                            monitoreo = monitoreo,
                            onPuntoSeleccionado = { idPunto ->
                                navegador.navigate(Rutas.detalle(idPunto))
                            },
                            onReintentar = { mapaVm.cargar() },
                        )
                    }

                    composable(Rutas.DETALLE) {
                        val detalleVm: DetalleViewModel = hiltViewModel()
                        val estadoDetalle by detalleVm.estado.collectAsStateWithLifecycle()
                        DetalleScreen(
                            estado = estadoDetalle,
                            onVolver = { navegador.popBackStack() },
                            onReintentar = { detalleVm.cargar() },
                        )
                    }

                    composable(Rutas.CONFIGURACION) {
                        ConfiguracionScreen(
                            estado =
                                EstadoConfiguracion(
                                    permiso = permiso,
                                    alertasActivas = alertasActivas,
                                    consentimiento = consentimiento,
                                ),
                            onAlternarAlertas = { activar ->
                                if (activar) {
                                    appVm.activarAlertas()
                                    if (permiso != EstadoPermisoUbicacion.CONCEDIDO) pedirPermiso()
                                } else {
                                    appVm.desactivarAlertas()
                                }
                            },
                            onAbrirPrivacidad = { navegador.navigate(Rutas.PRIVACIDAD) },
                            onVolver = { navegador.popBackStack() },
                        )
                    }

                    composable(Rutas.PRIVACIDAD) {
                        PoliticaPrivacidadScreen(onVolver = { navegador.popBackStack() })
                    }
                }
            }
        }

        alerta?.let { aviso ->
            AlertaScreen(
                alerta = aviso,
                onVolverAlMapa = { appVm.descartarAlerta() },
            )
        }
    }
}
