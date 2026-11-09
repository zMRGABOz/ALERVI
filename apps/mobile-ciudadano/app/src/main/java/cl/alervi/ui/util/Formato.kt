package cl.alervi.ui.util

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToLong

/**
 * Formato numérico y de fecha en español de Chile (RNF-U-3: 100 % español).
 *
 * Reglas: separador decimal coma, separador de miles punto, mes en minúsculas.
 * Funciones puras para poder probarlas en JVM (RNF-M-1).
 */
object Formato {
    /** Locale de presentación; no depende de la configuración del dispositivo. */
    val LOCAL: Locale = Locale.forLanguageTag("es-CL")

    /**
     * Índice de prioridad para el chip «/100»: se redondea al entero más
     * cercano porque la interfaz ciudadana no necesita decimales (RB-5).
     */
    fun indice(valor: Double): String = entero(valor.roundToLong().toInt())

    /** Entero con agrupación de miles chilena (1.234). */
    fun entero(valor: Int): String = NumberFormat.getIntegerInstance(LOCAL).format(valor)

    /** Decimal con cantidad fija de decimales (por ejemplo, 78,5). */
    fun decimal(
        valor: Double,
        decimales: Int = 1,
    ): String =
        NumberFormat.getNumberInstance(LOCAL).apply {
            minimumFractionDigits = decimales
            maximumFractionDigits = decimales
        }.format(valor)

    /** Fecha y hora local legible: «5 de noviembre de 2026, 11:43». */
    fun fechaHora(epochMs: Long): String =
        SimpleDateFormat("d 'de' MMMM 'de' yyyy, HH:mm", LOCAL).format(Date(epochMs))

    /** Fecha sin hora: «5 de noviembre de 2026». */
    fun fecha(epochMs: Long): String =
        SimpleDateFormat("d 'de' MMMM 'de' yyyy", LOCAL).format(Date(epochMs))
}
