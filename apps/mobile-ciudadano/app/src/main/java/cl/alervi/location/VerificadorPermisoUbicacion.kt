package cl.alervi.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject

/**
 * Consulta del permiso de ubicación precisa (TC-27).
 *
 * Aísla la dependencia del sistema para que las pruebas instrumentadas puedan
 * simular la denegación sin revocar el permiso real: en Android 14, revocar un
 * permiso de tiempo de ejecución con `UiAutomation` mata el proceso de la app
 * y, con él, el proceso de instrumentación.
 */
interface VerificadorPermisoUbicacion {
    /** True si la app tiene concedido `ACCESS_FINE_LOCATION`. */
    fun concedido(): Boolean
}

/** Implementación real sobre el permiso del sistema. */
class VerificadorPermisoSistema
    @Inject
    constructor(
        @ApplicationContext private val contexto: Context,
    ) : VerificadorPermisoUbicacion {
        override fun concedido(): Boolean =
            ContextCompat.checkSelfPermission(
                contexto,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
    }
