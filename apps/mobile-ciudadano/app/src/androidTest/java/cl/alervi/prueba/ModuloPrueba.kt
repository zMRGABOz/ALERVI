package cl.alervi.prueba

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import cl.alervi.data.local.CachePuntosPublicos
import cl.alervi.data.local.RegistroConsentimiento
import cl.alervi.di.ModuloUbicacion
import cl.alervi.di.NetworkModule
import cl.alervi.location.FuenteUbicacion
import cl.alervi.location.VerificadorPermisoUbicacion
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import java.io.File
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json

/**
 * Sustituciones Hilt para las pruebas instrumentadas.
 *
 * - Persistencia: DataStore de prueba en `filesDir` con nombre propio; el
 *   registro real del dispositivo no se toca. Solo guarda versión y fecha del
 *   consentimiento, nunca coordenadas (RNF-S-8).
 * - Ubicación: [FuenteUbicacionPrueba] en memoria, para inyectar posiciones
 *   sintéticas sin GPS ni permisos de ubicación reales.
 */
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [NetworkModule::class],
)
@Module
object ModuloPersistenciaPrueba {
    @Provides
    @Singleton
    fun json(): Json =
        Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = false
        }

    @Provides
    @Singleton
    fun cachePuntos(
        json: Json,
        @ApplicationContext context: Context,
    ): CachePuntosPublicos = CachePuntosPublicos(json, context.filesDir)

    @Provides
    @Singleton
    fun registroConsentimiento(
        @ApplicationContext context: Context,
    ): RegistroConsentimiento = RegistroConsentimiento(DataStoreConsentimientoPrueba.obtener(context))
}

/**
 * DataStore de prueba único por proceso.
 *
 * Hilt recrea el `SingletonComponent` entre métodos de prueba, pero el
 * proceso (y por tanto el archivo) es el mismo. Un DataStore nuevo por
 * componente dejaría el anterior activo y DataStore abortaría con
 * «multiple DataStores active for the same file». El scope vive lo que vive
 * el proceso de instrumentación y nunca se cancela entre pruebas.
 */
private object DataStoreConsentimientoPrueba {
    private const val NOMBRE_DATASTORE_PRUEBA = "consentimiento_prueba.preferences_pb"

    @Volatile
    private var instancia: DataStore<Preferences>? = null

    fun obtener(context: Context): DataStore<Preferences> =
        instancia ?: synchronized(this) {
            instancia ?: crear(context).also { instancia = it }
        }

    private fun crear(context: Context): DataStore<Preferences> =
        PreferenceDataStoreFactory.create(
            scope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
            produceFile = { File(context.filesDir, NOMBRE_DATASTORE_PRUEBA) },
        )
}

@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [ModuloUbicacion::class],
)
@Module
abstract class ModuloUbicacionPrueba {
    @Binds
    @Singleton
    abstract fun fuenteUbicacion(impl: FuenteUbicacionPrueba): FuenteUbicacion

    @Binds
    @Singleton
    abstract fun verificadorPermiso(impl: VerificadorPermisoPrueba): VerificadorPermisoUbicacion
}
