package cl.alervi.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStoreConsentimiento: DataStore<Preferences> by preferencesDataStore(
    name = "consentimiento_alervi",
)

/**
 * Registro LOCAL del consentimiento Ley 21.719 (E1 §5.3 L837–842, R-5).
 *
 * Tras la acción afirmativa («Activar alertas») se guardan en el dispositivo:
 *  - la versión del texto informativo aceptado, y
 *  - la fecha de aceptación.
 * El servidor NO guarda la identidad del ciudadano (§5.3).
 *
 * Este registro NO contiene coordenadas (RNF-S-8): solo versión y fecha.
 *
 * El almacenamiento real usa DataStore sobre filesDir; el constructor con
 * directorio permite probarlo en JVM (mismo formato de claves).
 */
class RegistroConsentimiento(
    private val dataStore: DataStore<Preferences>,
) {
    data class Consentimiento(
        val versionTexto: String,
        val fechaMs: Long,
    )

    /** Flujo reactivo del consentimiento registrado (null si nunca aceptó). */
    val flujo: Flow<Consentimiento?> =
        dataStore.data.map { prefs ->
            val version = prefs[CLAVE_VERSION]
            val fecha = prefs[CLAVE_FECHA]
            if (version != null && fecha != null) Consentimiento(version, fecha) else null
        }

    /** Registra versión del texto + fecha de aceptación (acción afirmativa). */
    suspend fun registrar(versionTexto: String, fechaMs: Long) {
        dataStore.edit { prefs ->
            prefs[CLAVE_VERSION] = versionTexto
            prefs[CLAVE_FECHA] = fechaMs
        }
    }

    /** Lectura única (para verificaciones puntuales). */
    suspend fun actual(): Consentimiento? = flujo.first()

    /** Retiro del consentimiento: desactivar las alertas borra el registro local. */
    suspend fun retirar() {
        dataStore.edit { prefs ->
            prefs.remove(CLAVE_VERSION)
            prefs.remove(CLAVE_FECHA)
        }
    }

    companion object {
        val CLAVE_VERSION = stringPreferencesKey("version_texto_consentimiento")
        val CLAVE_FECHA = longPreferencesKey("fecha_consentimiento_ms")

        /** Versión actual del texto informativo (cambia solo con control de cambios). */
        const val VERSION_TEXTO_ACTUAL: String = "consentimiento-ley-21719-v1"

        fun desdeContexto(context: Context): RegistroConsentimiento =
            RegistroConsentimiento(context.dataStoreConsentimiento)
    }
}
