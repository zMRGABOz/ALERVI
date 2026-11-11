package cl.alervi.domain.usecase

import cl.alervi.domain.model.AlertaProximidad
import cl.alervi.domain.model.EvaluacionAlerta

/**
 * Decisión de emitir u omitir el aviso de una evaluación de proximidad.
 *
 * Es una función PURA para poder probar en JVM las reglas de concurrencia de
 * RB-14 sin Android:
 *  - sin sesión activa no se avisa;
 *  - una evaluación suprimida por RB-13 no avisa;
 *  - un punto ya advertido en la sesión no vuelve a avisar;
 *  - mientras se reproduce un aviso sonoro no se inicia otro (exclusión
 *    mutua de audio); la ubicación se reevalúa cuando termina.
 */
sealed interface DecisionAviso {
    data class Emitir(val alerta: AlertaProximidad) : DecisionAviso

    data class Omitir(val motivo: MotivoOmisionAviso) : DecisionAviso
}

/** Motivo por el que no corresponde emitir el aviso. */
enum class MotivoOmisionAviso {
    SIN_SESION,
    SIN_ALERTA,
    PUNTO_YA_ADVERTIDO,
    AUDIO_OCUPADO,
}

object PoliticaAvisos {
    /**
     * @param evaluacion resultado de RB-13.
     * @param sesionActiva hay una sesión de alertas vigente (RB-14).
     * @param puntosAdvertidos ids ya advertidos en la sesión.
     * @param audioOcupado hay un aviso sonoro en reproducción.
     */
    fun decidir(
        evaluacion: EvaluacionAlerta,
        sesionActiva: Boolean,
        puntosAdvertidos: Set<Int>,
        audioOcupado: Boolean,
    ): DecisionAviso {
        if (!sesionActiva) return DecisionAviso.Omitir(MotivoOmisionAviso.SIN_SESION)
        if (evaluacion !is EvaluacionAlerta.ConAlerta) {
            return DecisionAviso.Omitir(MotivoOmisionAviso.SIN_ALERTA)
        }
        val alerta = evaluacion.alerta
        // RB-14: como máximo un aviso por punto crítico y por sesión.
        if (alerta.idPunto in puntosAdvertidos) {
            return DecisionAviso.Omitir(MotivoOmisionAviso.PUNTO_YA_ADVERTIDO)
        }
        // RB-14: no se superponen avisos sonoros; se reevalúa al finalizar.
        if (audioOcupado) return DecisionAviso.Omitir(MotivoOmisionAviso.AUDIO_OCUPADO)
        return DecisionAviso.Emitir(alerta)
    }
}
