package cl.alervi

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Aplicación ALERVI ciudadana (ALT-1, E1 §8.1).
 *
 * Raíz del grafo de Hilt: los repositorios de red se abstraen tras interfaces
 * inyectadas con implementaciones `mock` (fixtures locales) y `remote` (API local),
 * conforme a RD-05 y al contrato openapi.yaml (RNF-C-3).
 */
@HiltAndroidApp
class AlerviApp : Application()
