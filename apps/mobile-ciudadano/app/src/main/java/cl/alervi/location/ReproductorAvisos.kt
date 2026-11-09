package cl.alervi.location

import android.media.AudioManager
import android.media.ToneGenerator
import cl.alervi.domain.model.PatronSonoro
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reproductor de los avisos sonoros de proximidad (RF-8, RB-14).
 *
 * Exclusión mutua de audio: [tomar] reserva el canal de forma atómica y
 * [liberar] lo devuelve al terminar. Mientras está ocupado, la evaluación en
 * marcha NO inicia otro aviso; al finalizar se reevalúa la ubicación vigente
 * (RB-14), lo que ocurre naturalmente en la siguiente muestra de GPS.
 *
 * Se usa `ToneGenerator` sobre el stream de ALARMA para que el aviso de
 * seguridad resulte audible incluso con el teléfono en silencio o con la
 * pantalla bloqueada. No requiere archivos ni red (RD-01).
 *
 * RNF-S-8: aquí no se maneja ni registra ninguna coordenada.
 */
@Singleton
class ReproductorAvisos
    @Inject
    constructor() {

        private val ocupado = AtomicBoolean(false)

        private var generador: ToneGenerator? = null

        /** True mientras se reproduce un aviso (RB-14: sin superposición). */
        val estaOcupado: Boolean
            get() = ocupado.get()

        /** Reserva el canal de audio; false si ya hay un aviso sonando. */
        fun tomar(): Boolean = ocupado.compareAndSet(false, true)

        /** Devuelve el canal al terminar (o si no se pudo emitir). */
        fun liberar() {
            ocupado.set(false)
        }

        /**
         * Reproduce el patrón del contrato `AlertDetail.patron_sonoro`.
         * Es suspendida para que el llamador pueda mantener el canal reservado
         * exactamente durante la reproducción.
         */
        suspend fun reproducir(patron: PatronSonoro) {
            withContext(Dispatchers.Main.immediate) {
                val duracionMs = duracionMs(patron)
                runCatching {
                    val tono =
                        generador
                            ?: ToneGenerator(AudioManager.STREAM_ALARM, VOLUMEN).also {
                                generador = it
                            }
                    tono.startTone(tipoDeTono(patron), duracionMs)
                    // Margen para que el tono termine antes de liberar el canal.
                    delay(duracionMs.toLong() + MARGEN_MS)
                }
            }
        }

        private fun tipoDeTono(patron: PatronSonoro): Int =
            when (patron) {
                PatronSonoro.BEEP_URGENTE -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD
                PatronSonoro.BEEP_PRECAUCION -> ToneGenerator.TONE_PROP_BEEP2
                PatronSonoro.TONO_CORTO -> ToneGenerator.TONE_PROP_BEEP
            }

        private fun duracionMs(patron: PatronSonoro): Int =
            when (patron) {
                PatronSonoro.BEEP_URGENTE -> 1_200
                PatronSonoro.BEEP_PRECAUCION -> 600
                PatronSonoro.TONO_CORTO -> 300
            }

        private companion object {
            const val VOLUMEN = 100
            const val MARGEN_MS = 100L
        }
    }
