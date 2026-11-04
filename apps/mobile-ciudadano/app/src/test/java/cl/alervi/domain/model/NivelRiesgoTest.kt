package cl.alervi.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * TC base de dominio (RNF-M-1: ≥ 80 % líneas y ramas).
 * Verifica el mapeo del enum `nivel_riesgo` del contrato openapi.yaml
 * (PuntoCriticoProperties / PuntoCriticoPublicDetail) hacia el modelo de dominio.
 */
class NivelRiesgoTest {

    @Test
    fun `los cuatro niveles del contrato OpenAPI se mapean correctamente`() {
        assertEquals(NivelRiesgo.CRITICO, NivelRiesgo.desdeValor("CRITICO"))
        assertEquals(NivelRiesgo.ALTO, NivelRiesgo.desdeValor("ALTO"))
        assertEquals(NivelRiesgo.MEDIO, NivelRiesgo.desdeValor("MEDIO"))
        assertEquals(NivelRiesgo.BAJO, NivelRiesgo.desdeValor("BAJO"))
    }

    @Test
    fun `valor nulo o desconocido devuelve null y no se inventa un nivel`() {
        assertNull(NivelRiesgo.desdeValor(null))
        assertNull(NivelRiesgo.desdeValor("EXTREMO"))
        assertNull(NivelRiesgo.desdeValor(""))
    }

    @Test
    fun `el mapeo es tolerante a mayusculas y minusculas del backend`() {
        assertEquals(NivelRiesgo.ALTO, NivelRiesgo.desdeValor("alto"))
        assertEquals(NivelRiesgo.MEDIO, NivelRiesgo.desdeValor("Medio"))
    }

    @Test
    fun `las etiquetas de interfaz estan en espanol`() {
        assertEquals("Crítico", NivelRiesgo.CRITICO.etiqueta)
        assertEquals("Alto", NivelRiesgo.ALTO.etiqueta)
        assertEquals("Medio", NivelRiesgo.MEDIO.etiqueta)
        assertEquals("Bajo", NivelRiesgo.BAJO.etiqueta)
    }
}
