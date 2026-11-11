package cl.alervi.ui.util

import java.util.TimeZone
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * Formato chileno de números y fechas (RNF-U-3).
 * Se fija la zona horaria para que la prueba sea determinista.
 */
class FormatoTest {
    private lateinit var zonaOriginal: TimeZone

    @Before
    fun preparar() {
        zonaOriginal = TimeZone.getDefault()
        TimeZone.setDefault(TimeZone.getTimeZone("America/Santiago"))
    }

    @After
    fun restaurar() {
        TimeZone.setDefault(zonaOriginal)
    }

    @Test
    fun `indice redondea al entero`() {
        assertEquals("87", Formato.indice(86.6))
        assertEquals("87", Formato.indice(87.4))
        assertEquals("100", Formato.indice(100.0))
        assertEquals("0", Formato.indice(0.0))
    }

    @Test
    fun `entero usa punto como separador de miles`() {
        assertEquals("1.234", Formato.entero(1234))
        assertEquals("24", Formato.entero(24))
        assertEquals("0", Formato.entero(0))
    }

    @Test
    fun `decimal usa coma decimal`() {
        assertEquals("78,5", Formato.decimal(78.5))
        assertEquals("78,50", Formato.decimal(78.5, decimales = 2))
    }

    @Test
    fun `fecha y hora en espanol de Chile`() {
        val epochMs = 1_793_889_780_000L // 2026-11-05 11:43 en America/Santiago
        assertEquals("5 de noviembre de 2026, 11:43", Formato.fechaHora(epochMs))
        assertEquals("5 de noviembre de 2026", Formato.fecha(epochMs))
    }
}
