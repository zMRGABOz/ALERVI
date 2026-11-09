package cl.alervi.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

/**
 * Tema Material 3 de ALERVI.
 *
 * La app se presenta SIEMPRE en oscuro con la
 * paleta de los mockups; no se inventan equivalentes claros. El parámetro
 * [contenidoOscuro] se conserva por compatibilidad de firma, pero el esquema
 * aplicado es el oscuro en todos los casos.
 *
 * La tipografía se define en `sp` y sin alturas fijas: el escalado de texto
 * del sistema se respeta (E1 §4.4, TalkBack y texto ampliado).
 */
private val EsquemaOscuro =
    darkColorScheme(
        primary = TealAcento,
        onPrimary = TextoPrincipal,
        primaryContainer = TealAcento,
        onPrimaryContainer = TextoPrincipal,
        secondary = TealClaro,
        onSecondary = FondoAlervi,
        secondaryContainer = TealAcento,
        onSecondaryContainer = TextoPrincipal,
        tertiary = TealActivo,
        onTertiary = FondoAlervi,
        tertiaryContainer = SuperficieAlervi,
        onTertiaryContainer = TealClaro,
        background = FondoAlervi,
        onBackground = TextoPrincipal,
        surface = FondoAlervi,
        onSurface = TextoPrincipal,
        surfaceVariant = SuperficieAlervi,
        onSurfaceVariant = TextoPrincipalSuave,
        surfaceDim = FondoAlervi,
        surfaceBright = SuperficieAlervi,
        surfaceContainerLowest = FondoAlervi,
        surfaceContainerLow = SuperficieAlervi,
        surfaceContainer = SuperficieAlervi,
        surfaceContainerHigh = SuperficieAlervi,
        surfaceContainerHighest = SuperficieAlervi,
        outline = BordeAlervi,
        outlineVariant = BordeAlervi,
        error = RiesgoCritico,
        onError = TextoPrincipal,
        errorContainer = SuperficieAlervi,
        onErrorContainer = RiesgoCritico,
    )

@Composable
fun AlerviTheme(
    contenidoOscuro: Boolean = true,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = EsquemaOscuro,
        typography = TipografiaAlervi,
        content = content,
    )
}
