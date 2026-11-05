package cl.alervi.domain.model

import java.util.UUID

/**
 * Sesión de alertas del conductor (RB-14, E1 §6).
 *
 * - La sesión comienza cuando el usuario activa las alertas y finaliza cuando
 *   las desactiva (retiro del consentimiento, E1 §5.3).
 * - Durante una sesión se emite COMO MÁXIMO un aviso por punto crítico.
 * - Una pérdida temporal de GPS o conectividad, o el paso de la aplicación a
 *   segundo plano, NO reinicia el registro de puntos ya advertidos
 *   (por eso esta clase no expone reinicio automático).
 * - Un punto advertido puede volver a alertar en una NUEVA sesión.
 *
 * El identificador de sesión (`session_id`) viaja en `AlertCheckRequest`
 * (openapi.yaml) para que el servidor también aplique RB-14.
 */
class SesionAlertas(
    val idSesion: String = UUID.randomUUID().toString(),
) {
    private val advertidos = mutableSetOf<Int>()

    /** Puntos ya advertidos en esta sesión (inmutables hacia fuera). */
    val puntosAdvertidos: Set<Int>
        get() = advertidos.toSet()

    /** Marca un punto como advertido (tras emitir su aviso). */
    fun registrarAdvertido(idPunto: Int) {
        advertidos += idPunto
    }

    /** ¿Ya fue advertido este punto en la sesión vigente? */
    fun yaAdvertido(idPunto: Int): Boolean = idPunto in advertidos

    /**
     * Inicia una NUEVA sesión (solo al reactivar las alertas): nuevo
     * identificador y registro de advertidos vacío (RB-14).
     */
    fun reiniciar(): SesionAlertas = SesionAlertas()
}
