package cl.alervi.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cl.alervi.ui.theme.BordeAlervi
import cl.alervi.ui.theme.SuperficieAlervi

/**
 * Tarjeta base de ALERVI: superficie #191D25, borde #303640 y radio 20dp
 * (norma visual sobre los mockups 01–06).
 */
@Composable
fun TarjetaAlervi(
    modifier: Modifier = Modifier,
    contenido: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SuperficieAlervi),
        border = BorderStroke(1.dp, BordeAlervi),
        content = contenido,
    )
}
