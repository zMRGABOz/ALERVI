package cl.alervi.prueba

import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.domain.sesion.GestorSesionAlertas
import cl.alervi.domain.usecase.EvaluarProximidadUseCase
import cl.alervi.location.BusAvisos
import cl.alervi.location.ReproductorAvisos
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Acceso a los singletons del grafo Hilt desde la base de pruebas.
 *
 * Se usa un EntryPoint en lugar de campos `@Inject` heredados para que la
 * inyección no dependa del procesamiento de miembros de la superclase.
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface PuntoEntradaPrueba {
    fun registroConsentimiento(): RegistroConsentimiento

    fun gestorSesionAlertas(): GestorSesionAlertas

    fun busAvisos(): BusAvisos

    fun reproductorAvisos(): ReproductorAvisos

    fun fuenteUbicacionPrueba(): FuenteUbicacionPrueba

    fun verificadorPermisoPrueba(): VerificadorPermisoPrueba

    fun evaluarProximidad(): EvaluarProximidadUseCase
}
