package cl.alervi.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Tipografía ALERVI: jerarquía de los mockups 01–06.
 *
 * Todo en `sp` (E1 §4.4): se respeta el escalado de texto del sistema y no
 * hay alturas fijas que recorten el texto ampliado.
 *
 *  - título de pantalla ~28sp negrita (headlineMedium)
 *  - título de sección ~20sp negrita (titleLarge)
 *  - cuerpo 16sp (bodyLarge) · secundario 13–14sp (bodyMedium/bodySmall)
 *  - botón 17sp negrita (labelLarge)
 */
val TipografiaAlervi =
    Typography(
        // Marca «ALERVI» (pantalla 01).
        displaySmall =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Bold,
                fontSize = 34.sp,
                lineHeight = 40.sp,
                letterSpacing = 2.sp,
            ),
        // Título de pantalla.
        headlineMedium =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                lineHeight = 34.sp,
            ),
        // Título de sección.
        titleLarge =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                lineHeight = 26.sp,
            ),
        // Título de tarjeta o fila.
        titleMedium =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                lineHeight = 22.sp,
            ),
        // Cuerpo.
        bodyLarge =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Normal,
                fontSize = 16.sp,
                lineHeight = 24.sp,
            ),
        // Cuerpo compacto y textos largos en tarjetas.
        bodyMedium =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                lineHeight = 21.sp,
            ),
        // Secundario pequeño (detalles de fila, avisos).
        bodySmall =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Normal,
                fontSize = 13.sp,
                lineHeight = 18.sp,
            ),
        // Etiqueta de botón (17sp negrita).
        labelLarge =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                lineHeight = 22.sp,
            ),
        // Etiquetas de leyenda y rótulos.
        labelMedium =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                lineHeight = 18.sp,
            ),
        // Atribución y pies.
        labelSmall =
            TextStyle(
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                lineHeight = 16.sp,
            ),
    )
