package cl.alervi.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import com.google.gson.JsonObject
import com.google.gson.JsonPrimitive
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

/**
 * Mapa público de puntos críticos (RF-2).
 *
 * Decisiones técnicas:
 *  - Base CARTO Positron. La atribución nativa de
 *    MapLibre queda SIEMPRE habilitada (REF-10 OSM + REF-11 CARTO).
 *  - Código de color por `nivel_riesgo`: CRITICO #EF4058,
 *    ALTO #F6A15A, MEDIO #F7BC53, BAJO #939AA6.
 *  - Marcadores = `GeoJsonSource` + `CircleLayer`, con la propiedad "color" en
 *    cada feature; los puntos se actualizan en caliente sin recrear el mapa.
 *    `circle-radius` y `circle-stroke-width` son PÍXELES de pantalla en
 *    MapLibre: se multiplican por la densidad para verse como dp reales.
 *  - Si el estilo no carga (sin red), el mapa queda vacío sin crashear; los
 *    datos de puntos ya son locales (fixtures según flavor).
 *  - Privacidad (RNF-S-8): no se registran coordenadas en logs.
 */
private const val URL_ESTILO_POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

/** Identificador de la fuente GeoJSON de puntos críticos. */
private const val FUENTE_PUNTOS = "fuente-puntos-criticos"

/** Identificador de la capa de círculos de puntos críticos (clic consultable). */
private const val CAPA_PUNTOS = "capa-puntos-criticos"

/** Cámara inicial del mapa público: Concepción (RB-1, zona piloto). */
private const val MODELO_CONCEPCION_LAT = -36.8270

private const val MODELO_CONCEPCION_LON = -73.0503

private const val ZOOM_INICIAL: Double = 12.5

private const val ZOOM_MINI_MAPA: Double = 16.0

/** Radio del marcador en dp (se convierte a px según la densidad del dispositivo). */
private const val RADIO_MARCADOR_DP = 7f

/** Borde blanco del marcador en dp (idem densidad-independiente). */
private const val BORDE_MARCADOR_DP = 1.8f

private const val COLOR_BORDE_MARCADOR = "#FFFFFF"

/**
 * Rojo de riesgo para el marcador del mini mapa (la llamada de la
 * pantalla no entrega el nivel; se usa el color de CRITICO, máxima urgencia).
 */
private const val COLOR_RIESGO = "#EF4058"

private const val COLOR_CRITICO = "#EF4058"

private const val COLOR_ALTO = "#F6A15A"

private const val COLOR_MEDIO = "#F7BC53"

private const val COLOR_BAJO = "#939AA6"

/** Color de riesgo del nivel como hex (paleta de la app). */
internal fun NivelRiesgo.colorHexRiesgo(): String =
    when (this) {
        NivelRiesgo.CRITICO -> COLOR_CRITICO
        NivelRiesgo.ALTO -> COLOR_ALTO
        NivelRiesgo.MEDIO -> COLOR_MEDIO
        NivelRiesgo.BAJO -> COLOR_BAJO
    }

/** Construye la colección GeoJSON de los puntos críticos con color por nivel. */
private fun construirColeccion(puntos: List<PuntoCritico>): FeatureCollection =
    FeatureCollection.fromFeatures(
        puntos.map { punto ->
            val propiedades =
                JsonObject().apply {
                    addProperty("id_punto", punto.idPunto)
                    addProperty("color", punto.nivelRiesgo.colorHexRiesgo())
                    addProperty("nombre", punto.nombreInterseccion)
                }
            Feature.fromGeometry(
                Point.fromLngLat(punto.longitud, punto.latitud),
                propiedades,
            )
        },
    )

private fun coleccionVacia(): FeatureCollection = FeatureCollection.fromFeatures(ArrayList())

/** Feature puntual de un solo marcador con su color de riesgo. */
private fun featurePunto(
    latitud: Double,
    longitud: Double,
    color: String,
): Feature =
    Feature.fromGeometry(
        Point.fromLngLat(longitud, latitud),
        JsonObject().apply { addProperty("color", color) },
    )

/**
 * Capa de círculos: color por propiedad "color" y borde blanco.
 * El radio y el borde llegan ya en PÍXELES de pantalla (dp × densidad).
 */
private fun crearCapaPuntos(
    idCapa: String,
    idFuente: String,
    radioPx: Float,
    bordePx: Float,
): CircleLayer =
    CircleLayer(idCapa, idFuente).withProperties(
        PropertyFactory.circleRadius(radioPx),
        PropertyFactory.circleColor(Expression.get("color")),
        PropertyFactory.circleStrokeWidth(bordePx),
        PropertyFactory.circleStrokeColor(COLOR_BORDE_MARCADOR),
        PropertyFactory.circleOpacity(1.0f),
    )

/**
 * Estado interno del mapa (no recreable al cambiar los datos): conserva la
 * referencia al mapa y permite publicar la colección vigente en la fuente
 * GeoJSON cuando el estilo esté cargado.
 */
private class ControladorMapaPuntos(
    val fuente: GeoJsonSource,
) {
    var mapa: MapLibreMap? = null

    var coleccion: FeatureCollection = coleccionVacia()

    /** Publica la colección vigente; si el estilo aún no está cargado, queda en cola. */
    fun publicarPuntos() {
        mapa?.getStyle { estilo ->
            estilo.getSourceAs<GeoJsonSource>(fuente.id)?.setGeoJson(coleccion)
        }
    }
}

/**
 * Envoltorio del [MapView] con destrucción IDEMPOTENTE: MapLibre no tolera
 * llamar `onDestroy()` dos veces (rotación, cierre de actividad), así que la
 * destrucción real ocurre a lo más una vez, sea por el evento ON_DESTROY del
 * ciclo de vida o por la eliminación del Composable.
 */
private class VistaMapaCiclo(
    val vista: MapView,
) {
    private var destruida = false

    fun destruir() {
        if (!destruida) {
            destruida = true
            vista.onDestroy()
        }
    }
}

/** Puente entre el ciclo de vida del Composable y el de MapView, sin fugas. */
@Composable
private fun RecordatorioCicloMapa(
    conjunto: VistaMapaCiclo,
    propiedadClave: Any,
) {
    val propietarioCiclo = LocalLifecycleOwner.current
    DisposableEffect(propietarioCiclo, propiedadClave) {
        val vistaMapa = conjunto.vista
        val observador =
            LifecycleEventObserver { _, evento ->
                when (evento) {
                    Lifecycle.Event.ON_START -> vistaMapa.onStart()
                    Lifecycle.Event.ON_RESUME -> vistaMapa.onResume()
                    Lifecycle.Event.ON_PAUSE -> vistaMapa.onPause()
                    Lifecycle.Event.ON_STOP -> {
                        vistaMapa.onLowMemory()
                        vistaMapa.onStop()
                    }
                    Lifecycle.Event.ON_DESTROY -> {
                        vistaMapa.onLowMemory()
                        conjunto.destruir() // idempotente
                    }
                    else -> {}
                }
            }
        propietarioCiclo.lifecycle.addObserver(observador)
        // La composición suele ocurrir con el host ya en STARTED/RESUMED: el
        // observador no recibirá esos eventos pasados, se aplica el estado
        // vigente manualmente (MapView exige onStart/onResume para dibujar).
        val estadoActual = propietarioCiclo.lifecycle.currentState
        when {
            estadoActual.isAtLeast(Lifecycle.State.RESUMED) -> {
                vistaMapa.onStart()
                vistaMapa.onResume()
            }
            estadoActual.isAtLeast(Lifecycle.State.STARTED) -> vistaMapa.onStart()
        }
        onDispose {
            propietarioCiclo.lifecycle.removeObserver(observador)
            conjunto.destruir() // idempotente: no se destruye dos veces
        }
    }
}

/**
 * Mapa interactivo de puntos críticos (pantalla 03, RF-2).
 *
 * @param puntos Puntos críticos a dibujar; cambiarlos NO recrea el mapa.
 * @param onPuntoSeleccionado Invocado con el id del punto tocado.
 */
@Composable
fun MapaAlervi(
    puntos: List<PuntoCritico>,
    onPuntoSeleccionado: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val contexto = LocalContext.current
    // Idempotente: MapLibre.getInstance debe ejecutarse antes de crear MapView
    // AlerviApp.onCreate ya lo inicializó.
    MapLibre.getInstance(contexto)

    // circle-radius/circle-stroke-width son px de pantalla en MapLibre:
    // se escalan por densidad para lograr 7dp/1.8dp reales.
    val densidad = LocalDensity.current.density
    val radioPx = RADIO_MARCADOR_DP * densidad
    val bordePx = BORDE_MARCADOR_DP * densidad

    val accionSeleccion = rememberUpdatedState(onPuntoSeleccionado)
    val coleccionInicial = remember { construirColeccion(puntos) }
    val controlador = remember { ControladorMapaPuntos(GeoJsonSource(FUENTE_PUNTOS, coleccionInicial)) }
    val vistaMapa =
        remember {
            VistaMapaCiclo(
                MapView(contexto).apply {
                    // MapView exige onCreate antes de cualquier onStart/onResume.
                    onCreate(null)
                },
            )
        }

    RecordatorioCicloMapa(vistaMapa, propiedadClave = Unit)

    // Mapa + estilo + capa de puntos + clic en marcador, UNA sola vez.
    DisposableEffect(Unit) {
        vistaMapa.vista.getMapAsync { mapa ->
            controlador.mapa = mapa
            // REF-10/REF-11: atribución OSM/CARTO siempre visible.
            mapa.uiSettings.setAttributionEnabled(true)
            // Cámara inicial: Concepción, zoom 12.5 (RB-1, zona piloto).
            mapa.moveCamera(
                CameraUpdateFactory.newLatLngZoom(
                    LatLng(MODELO_CONCEPCION_LAT, MODELO_CONCEPCION_LON),
                    ZOOM_INICIAL,
                ),
            )
            mapa.setStyle(
                Style.Builder().fromUri(URL_ESTILO_POSITRON),
                Style.OnStyleLoaded { estilo ->
                    estilo.addSource(controlador.fuente)
                    estilo.addLayer(crearCapaPuntos(CAPA_PUNTOS, FUENTE_PUNTOS, radioPx, bordePx))
                    controlador.publicarPuntos()
                    // Clic en marcador: se consultan las features renderizadas
                    // en el punto tocado y se extrae id_punto (RF-2). El
                    // listener devuelve true solo si consumió el clic.
                    mapa.addOnMapClickListener { latLng ->
                        val puntoPantalla = mapa.projection.toScreenLocation(latLng)
                        val caracteristicas = mapa.queryRenderedFeatures(puntoPantalla, CAPA_PUNTOS)
                        val idPunto =
                            caracteristicas.firstOrNull()
                                ?.getProperty("id_punto")
                                ?.let { elemento ->
                                    if (elemento is JsonPrimitive && elemento.isNumber) {
                                        elemento.asInt
                                    } else {
                                        null
                                    }
                                }
                        if (idPunto != null) {
                            accionSeleccion.value(idPunto)
                            true
                        } else {
                            false
                        }
                    }
                },
            )
        }
        onDispose {
            controlador.mapa = null
            vistaMapa.destruir() // idempotente junto con el ciclo de vida
        }
    }

    // Actualización de los marcadores sin recrear el mapa (RF-2).
    LaunchedEffect(puntos) {
        controlador.coleccion = construirColeccion(puntos)
        controlador.publicarPuntos()
    }

    AndroidView(
        modifier = modifier,
        factory = { vistaMapa.vista },
    )
}

/**
 * Mini mapa NO interactivo de un punto crítico (pantalla 04, RF-2): centrado
 * en el punto con zoom fijo, gestos deshabilitados y marcador de riesgo.
 * La atribución nativa de MapLibre permanece habilitada (REF-10/REF-11).
 */
@Composable
fun MiniMapaAlervi(
    latitud: Double,
    longitud: Double,
    modifier: Modifier = Modifier,
) {
    val contexto = LocalContext.current
    MapLibre.getInstance(contexto)

    val densidad = LocalDensity.current.density
    val radioPx = RADIO_MARCADOR_DP * densidad
    val bordePx = BORDE_MARCADOR_DP * densidad

    val vistaMapa =
        remember {
            VistaMapaCiclo(
                MapView(contexto).apply { onCreate(null) },
            )
        }

    RecordatorioCicloMapa(vistaMapa, propiedadClave = Unit)

    DisposableEffect(Unit) {
        vistaMapa.vista.getMapAsync { mapa ->
            // Mini mapa de solo lectura: todos los gestos deshabilitados;
            // la atribución se mantiene visible (REF-10 OSM + REF-11 CARTO).
            mapa.uiSettings.setAllGesturesEnabled(false)
            mapa.uiSettings.setAttributionEnabled(true)
            mapa.moveCamera(
                CameraUpdateFactory.newLatLngZoom(
                    LatLng(latitud, longitud),
                    ZOOM_MINI_MAPA,
                ),
            )
            mapa.setStyle(
                Style.Builder().fromUri(URL_ESTILO_POSITRON),
                Style.OnStyleLoaded { estilo ->
                    val fuente =
                        GeoJsonSource(
                            FUENTE_PUNTOS,
                            featurePunto(latitud, longitud, COLOR_RIESGO),
                        )
                    estilo.addSource(fuente)
                    estilo.addLayer(crearCapaPuntos(CAPA_PUNTOS, FUENTE_PUNTOS, radioPx, bordePx))
                },
            )
        }
        onDispose {
            vistaMapa.destruir() // idempotente junto con el ciclo de vida
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { vistaMapa.vista },
    )
}
