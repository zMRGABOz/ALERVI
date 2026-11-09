package cl.alervi.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import cl.alervi.ui.navigation.AlerviRoot
import dagger.hilt.android.AndroidEntryPoint

/**
 * Actividad principal (RF-2: consulta pública sin cuenta ni autenticación).
 *
 * La interfaz se compone en [AlerviRoot], que decide el destino
 * inicial según el consentimiento registrado (E1 §5.3) y orquesta el
 * permiso de ubicación con acción afirmativa previa.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AlerviRoot()
        }
    }
}
