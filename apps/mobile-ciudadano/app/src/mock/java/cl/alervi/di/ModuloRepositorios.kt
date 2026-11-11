package cl.alervi.di

import android.content.Context
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.data.repository.AlertasRepository
import cl.alervi.data.repository.mock.MockAlertasRepository
import cl.alervi.data.repository.mock.MockPuntosRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json

/**
 * Flavor `mock` (RD-01): enlaces de repositorios SIN red.
 * Los fixtures viven en assets y cumplen openapi.yaml.
 */
@Module
@InstallIn(SingletonComponent::class)
object ModuloRepositorios {

    @Provides
    @Singleton
    fun proveedorFixtures(
        @ApplicationContext context: Context,
    ): () -> String = {
        context.assets.open(FIXTURE_PUNTOS).bufferedReader().use { it.readText() }
    }

    @Provides
    @Singleton
    fun puntosRepository(
        json: Json,
        proveedorFixture: () -> String,
    ): PuntosRepository = MockPuntosRepository(json, proveedorFixture)

    @Provides
    @Singleton
    fun alertasRepository(repo: MockAlertasRepository): AlertasRepository = repo

    private const val FIXTURE_PUNTOS = "fixtures/puntos_criticos_publicos.json"
}
