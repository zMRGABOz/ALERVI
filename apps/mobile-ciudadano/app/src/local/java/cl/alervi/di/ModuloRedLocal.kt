package cl.alervi.di

import cl.alervi.BuildConfig
import cl.alervi.data.api.AlertasApi
import cl.alervi.data.api.HealthApi
import cl.alervi.data.api.PublicoApi
import cl.alervi.data.repository.AlertasRepository
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.data.repository.remote.RemoteAlertasRepository
import cl.alervi.data.repository.remote.RemotePuntosRepository
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Flavor `local`: red contra http://10.0.2.2:8000 (contenedor FastAPI del
 * repo, `docker compose up`; RNF-P-1). Cleartext SOLO hacia 10.0.2.2/localhost
 * y solo en debug (network_security_config, RNF-S-3).
 *
 * Timeouts: 3 s de tope por llamada (R-8 para `POST /api/v1/alerts`;
 * RNF-R-1 exige p95 ≤ 1 s, con lo que 3 s es cota de falla razonable).
 * SIN interceptor de logging: RNF-S-8 prohíbe coordenadas en Logcat.
 */
@Module
@InstallIn(SingletonComponent::class)
object ModuloRedLocal {

    @Provides
    @Singleton
    fun proveerOkHttp(): OkHttpClient =
        OkHttpClient
            .Builder()
            .connectTimeout(3, TimeUnit.SECONDS)
            .readTimeout(3, TimeUnit.SECONDS)
            .writeTimeout(3, TimeUnit.SECONDS)
            .callTimeout(3, TimeUnit.SECONDS) // R-8: fallback local a los 3 s
            .build()

    @Provides
    @Singleton
    fun proveerRetrofit(
        client: OkHttpClient,
        json: Json,
    ): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(BuildConfig.BASE_URL) // http://10.0.2.2:8000/ (flavor local)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @Singleton
    fun proveerPublicoApi(retrofit: Retrofit): PublicoApi = retrofit.create(PublicoApi::class.java)

    @Provides
    @Singleton
    fun proveerAlertasApi(retrofit: Retrofit): AlertasApi = retrofit.create(AlertasApi::class.java)

    @Provides
    @Singleton
    fun proveerHealthApi(retrofit: Retrofit): HealthApi = retrofit.create(HealthApi::class.java)
}

@Module
@InstallIn(SingletonComponent::class)
abstract class ModuloRepositoriosLocal {
    @Binds
    @Singleton
    abstract fun puntosRepository(impl: RemotePuntosRepository): PuntosRepository

    @Binds
    @Singleton
    abstract fun alertasRepository(impl: RemoteAlertasRepository): AlertasRepository
}
