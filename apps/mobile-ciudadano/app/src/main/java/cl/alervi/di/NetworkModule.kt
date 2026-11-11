package cl.alervi.di

import android.content.Context
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.data.local.RegistroConsentimiento
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json

/**
 * Módulo de persistencia local compartido por flavors (main).
 *
 * - `Json` tolerante: ignora campos nuevos del backend sin romper el cliente
 *   (compatibilidad evolutiva del contrato, RNF-C-3) y omite nulls al serializar.
 * - Sin interceptor de logging: RNF-S-8 prohíbe escribir posiciones en Logcat.
 * - `CachePuntosPublicos` sobre `filesDir` (R-8; solo datos públicos de puntos).
 *
 * La red (OkHttp/Retrofit contra `BuildConfig.BASE_URL` del flavor) se arma
 * en el módulo del flavor `local`; el flavor `mock` no usa red.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun proveerJson(): Json =
        Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = false
        }

    @Provides
    @Singleton
    fun proveerCachePuntos(
        json: Json,
        @ApplicationContext context: Context,
    ): CachePuntosPublicos = CachePuntosPublicos(json, context.filesDir)

    /**
     * Registro LOCAL del consentimiento Ley 21.719 (§5.3, R-5) sobre
     * DataStore; singleton porque el delegate de DataStore debe ser único
     * por archivo. NO contiene coordenadas (RNF-S-8).
     */
    @Provides
    @Singleton
    fun proveerRegistroConsentimiento(@ApplicationContext context: Context): RegistroConsentimiento =
        RegistroConsentimiento.desdeContexto(context)
}
