package cl.alervi.ui.viewmodel

import androidx.lifecycle.SavedStateHandle
import cl.alervi.MainDispatcherRule
import cl.alervi.data.repository.PuntosRepository
import cl.alervi.domain.model.DetallePuntoCritico
import cl.alervi.domain.model.NivelRiesgo
import cl.alervi.domain.model.PuntoCritico
import cl.alervi.ui.estado.EstadoDetalle
import cl.alervi.ui.navigation.Rutas
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** Pruebas JVM del detalle público (RF-2; RB-2/RB-6). */
class DetalleViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `id valido como texto carga el detalle`() {
        val detalle = detalle(101)
        val vm =
            DetalleViewModel(
                FakePuntosRepository(Result.success(detalle)),
                SavedStateHandle(mapOf(Rutas.ARG_ID_PUNTO to "101")),
            )

        assertEquals(EstadoDetalle.Listo(detalle), vm.estado.value)
    }

    @Test
    fun `id valido como entero carga el detalle`() {
        val detalle = detalle(102)
        val vm =
            DetalleViewModel(
                FakePuntosRepository(Result.success(detalle)),
                SavedStateHandle(mapOf(Rutas.ARG_ID_PUNTO to 102)),
            )

        assertEquals(EstadoDetalle.Listo(detalle), vm.estado.value)
    }

    @Test
    fun `id ausente publica Error y no consulta el repositorio`() {
        val repo = FakePuntosRepository(Result.success(detalle(1)))
        val vm = DetalleViewModel(repo, SavedStateHandle())

        assertEquals(EstadoDetalle.Error, vm.estado.value)
        assertEquals(0, repo.consultas)
    }

    @Test
    fun `id no numerico publica Error`() {
        val vm =
            DetalleViewModel(
                FakePuntosRepository(Result.success(detalle(1))),
                SavedStateHandle(mapOf(Rutas.ARG_ID_PUNTO to "abc")),
            )

        assertEquals(EstadoDetalle.Error, vm.estado.value)
    }

    @Test
    fun `falla del repositorio publica Error`() {
        val vm =
            DetalleViewModel(
                FakePuntosRepository(Result.failure(IllegalStateException("sin red"))),
                SavedStateHandle(mapOf(Rutas.ARG_ID_PUNTO to "101")),
            )

        assertEquals(EstadoDetalle.Error, vm.estado.value)
    }

    @Test
    fun `reintentar tras falla publica Listo`() {
        val repo = FakePuntosRepository(Result.failure(IllegalStateException("sin red")))
        val vm = DetalleViewModel(repo, SavedStateHandle(mapOf(Rutas.ARG_ID_PUNTO to "101")))
        assertEquals(EstadoDetalle.Error, vm.estado.value)

        val detalle = detalle(101)
        repo.resultado = Result.success(detalle)
        vm.cargar()

        assertTrue(vm.estado.value is EstadoDetalle.Listo)
        assertEquals(101, (vm.estado.value as EstadoDetalle.Listo).detalle.idPunto)
    }

    private fun detalle(id: Int) =
        DetallePuntoCritico(
            idPunto = id,
            nombreInterseccion = "Punto $id",
            comuna = "Concepción",
            latitud = -36.83,
            longitud = -73.05,
            nivelRiesgo = NivelRiesgo.ALTO,
            indicePrioridad = 70.0,
            totalSiniestros = 10,
            advertenciaLegal = "Índice relativo (RB-6).",
        )

    private class FakePuntosRepository(
        var resultado: Result<DetallePuntoCritico>,
    ) : PuntosRepository {
        var consultas: Int = 0

        override suspend fun obtenerPuntos(
            comuna: String?,
            bbox: String?,
        ): Result<List<PuntoCritico>> = Result.success(emptyList())

        override suspend fun obtenerDetalle(idPunto: Int): Result<DetallePuntoCritico> {
            consultas++
            return resultado
        }
    }
}
