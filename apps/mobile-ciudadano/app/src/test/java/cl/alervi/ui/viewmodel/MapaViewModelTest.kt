package cl.alervi.ui.viewmodel

import cl.alervi.MainDispatcherRule
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.ui.estado.EstadoMapa
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Pruebas JVM de los estados del mapa (RF-2; TC-06/TC-07).
 *
 * La distinción «sin resultados» vs «falla» es obligatoria: la UI nunca debe
 * presentar una falla como ausencia de puntos ni una lista vacía como ausencia
 * de riesgo (RB-2).
 */
class MapaViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `consulta exitosa con puntos publica Listo`() {
        val punto = punto(101)
        val vm = MapaViewModel(FakePuntosRepository(resultado = Result.success(listOf(punto))))

        assertEquals(EstadoMapa.Listo(listOf(punto)), vm.estado.value)
    }

    @Test
    fun `consulta exitosa vacia publica SinPuntos y no Error`() {
        val vm = MapaViewModel(FakePuntosRepository(resultado = Result.success(emptyList())))

        assertEquals(EstadoMapa.SinPuntos, vm.estado.value)
    }

    @Test
    fun `falla de consulta publica Error`() {
        val vm = MapaViewModel(FakePuntosRepository(resultado = Result.failure(IllegalStateException("sin red"))))

        assertEquals(EstadoMapa.Error, vm.estado.value)
    }

    @Test
    fun `reintentar tras falla recarga y publica Listo`() {
        val repo = FakePuntosRepository(resultado = Result.failure(IllegalStateException("sin red")))
        val vm = MapaViewModel(repo)
        assertEquals(EstadoMapa.Error, vm.estado.value)

        repo.resultado = Result.success(listOf(punto(102)))
        vm.cargar()

        assertTrue(vm.estado.value is EstadoMapa.Listo)
        assertEquals(102, (vm.estado.value as EstadoMapa.Listo).puntos.single().idPunto)
    }

    private fun punto(id: Int) =
        PuntoCritico(
            idPunto = id,
            longitud = -73.05,
            latitud = -36.83,
            nombreInterseccion = "Punto $id",
            comuna = "Concepción",
            nivelRiesgo = NivelRiesgo.ALTO,
            indicePrioridad = 70.0,
            totalSiniestros = 10,
        )

    private class FakePuntosRepository(
        var resultado: Result<List<PuntoCritico>>,
    ) : PuntosRepository {
        override suspend fun obtenerPuntos(
            comuna: String?,
            bbox: String?,
        ): Result<List<PuntoCritico>> = resultado

        override suspend fun obtenerDetalle(idPunto: Int): Result<DetallePuntoCritico> =
            Result.failure(UnsupportedOperationException())
    }
}
