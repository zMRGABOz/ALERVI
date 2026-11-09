package cl.alervi.ui.navigation

/** Rutas de navegación de la app ciudadana. */
object Rutas {
    const val BIENVENIDA = "bienvenida"
    const val CONSENTIMIENTO = "consentimiento"
    const val MAPA = "mapa"
    const val CONFIGURACION = "configuracion"
    const val PRIVACIDAD = "privacidad"

    const val ARG_ID_PUNTO = "idPunto"
    const val DETALLE = "detalle/{$ARG_ID_PUNTO}"

    fun detalle(idPunto: Int): String = "detalle/$idPunto"
}
