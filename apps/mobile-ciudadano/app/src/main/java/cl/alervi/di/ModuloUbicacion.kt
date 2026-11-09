package cl.alervi.di

import cl.alervi.location.ClienteUbicacion
import cl.alervi.location.FuenteUbicacion
import cl.alervi.location.VerificadorPermisoSistema
import cl.alervi.location.VerificadorPermisoUbicacion
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Enlace de la fuente de ubicación real (RF-8).
 *
 * El [cl.alervi.location.ServicioAlertasProximidad] depende de la interfaz
 * [FuenteUbicacion]; las pruebas instrumentadas reemplazan este módulo por
 * una fuente sintética en memoria. La ubicación nunca se persiste (RNF-S-8).
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class ModuloUbicacion {

    @Binds
    @Singleton
    abstract fun fuenteUbicacion(impl: ClienteUbicacion): FuenteUbicacion

    @Binds
    @Singleton
    abstract fun verificadorPermiso(impl: VerificadorPermisoSistema): VerificadorPermisoUbicacion
}
