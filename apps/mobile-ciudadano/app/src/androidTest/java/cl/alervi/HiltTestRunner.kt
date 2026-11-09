package cl.alervi

import android.app.Application
import android.content.Context
import androidx.test.runner.AndroidJUnitRunner
import dagger.hilt.android.testing.HiltTestApplication

/**
 * Runner de pruebas instrumentadas.
 *
 * Usa [HiltTestApplication] para que los módulos `@TestInstallIn` sustituyan
 * la persistencia y la fuente de ubicación por dobles en memoria, sin tocar
 * los datos reales del dispositivo ni depender del GPS del emulador.
 */
class HiltTestRunner : AndroidJUnitRunner() {
    override fun newApplication(
        cl: ClassLoader?,
        className: String?,
        context: Context?,
    ): Application = super.newApplication(cl, HiltTestApplication::class.java.name, context)
}
