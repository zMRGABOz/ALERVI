package cl.alervi.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import cl.alervi.R
import cl.alervi.ui.estado.PestanaAlervi
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.SuperficieAlervi
import cl.alervi.ui.theme.TealAcento
import cl.alervi.ui.theme.TealActivo
import cl.alervi.ui.theme.TextoPrincipal
import cl.alervi.ui.theme.TextoSecundario

/**
 * Barra inferior de 2 pestañas (Mapa / Ajustes); se omite la pestaña «Puntos».
 *
 * Accesibilidad (E1 §4.4): la barra tiene descripción y cada pestaña expone
 * su etiqueta textual; los iconos son decorativos.
 */
@Composable
fun AlerviBarraInferior(
    pestanaActual: PestanaAlervi,
    onMapa: () -> Unit,
    onAjustes: () -> Unit,
) {
    val descripcionBarra = stringResource(R.string.barra_inferior_descripcion)
    Column(modifier = Modifier.fillMaxWidth()) {
        HorizontalDivider(color = BordeAlervi)
        NavigationBar(
            modifier = Modifier.semantics { contentDescription = descripcionBarra },
            containerColor = SuperficieAlervi,
            contentColor = TextoSecundario,
        ) {
            NavigationBarItem(
                selected = pestanaActual == PestanaAlervi.MAPA,
                onClick = onMapa,
                icon = {
                    Icon(
                        imageVector = Icons.Filled.Place,
                        contentDescription = null,
                    )
                },
                label = { Text(text = stringResource(R.string.barra_pestana_mapa)) },
                colors =
                    NavigationBarItemDefaults.colors(
                        indicatorColor = TealAcento,
                        selectedIconColor = TextoPrincipal,
                        selectedTextColor = TealActivo,
                        unselectedIconColor = TextoSecundario,
                        unselectedTextColor = TextoSecundario,
                    ),
            )
            NavigationBarItem(
                selected = pestanaActual == PestanaAlervi.AJUSTES,
                onClick = onAjustes,
                icon = {
                    Icon(
                        imageVector = Icons.Filled.Settings,
                        contentDescription = null,
                    )
                },
                label = { Text(text = stringResource(R.string.barra_pestana_ajustes)) },
                colors =
                    NavigationBarItemDefaults.colors(
                        indicatorColor = TealAcento,
                        selectedIconColor = TextoPrincipal,
                        selectedTextColor = TealActivo,
                        unselectedIconColor = TextoSecundario,
                        unselectedTextColor = TextoSecundario,
                    ),
            )
        }
    }
}
