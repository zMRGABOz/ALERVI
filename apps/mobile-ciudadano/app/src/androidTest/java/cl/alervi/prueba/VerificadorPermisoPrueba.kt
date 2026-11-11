package cl.alervi.prueba

import cl.alervi.location.VerificadorPermisoUbicacion
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Verificador de permiso controlable por las pruebas (TC-27).
 *
 * Permite ejercitar la rama «permiso denegado» sin revocar el permiso real:
 * en Android 14 esa revocación mata el proceso de instrumentación.
 */
@Singleton
class VerificadorPermisoPrueba
    @Inject
    constructor() : VerificadorPermisoUbicacion {
        @Volatile
        private var concedido: Boolean = true

        override fun concedido(): Boolean = concedido

        fun conceder() {
            concedido = true
        }

        fun denegar() {
            concedido = false
        }
    }
