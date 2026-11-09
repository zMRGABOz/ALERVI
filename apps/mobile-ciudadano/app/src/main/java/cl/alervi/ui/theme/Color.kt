package cl.alervi.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Paleta normativa de ALERVI.
 *
 * Fuente: colores de los mockups de la app.
 * No se inventan tonos: cada constante proviene de los mockups y
 * la app se presenta siempre en oscuro con esta paleta.
 */

// Fondo y superficies.
val FondoAlervi = Color(0xFF101216)
val SuperficieAlervi = Color(0xFF191D25)
val BordeAlervi = Color(0xFF303640)

// Acento teal (CTA y elementos activos).
val TealAcento = Color(0xFF0C8882)
val TealClaro = Color(0xFF13A89A)
val TealActivo = Color(0xFF19B69E)

// Texto.
val TextoPrincipal = Color(0xFFF3F5F7)
val TextoPrincipalSuave = Color(0xFFE9EFF3)
val TextoSecundario = Color(0xFF939AA6)

// Niveles de riesgo (enum `nivel_riesgo` de openapi.yaml).
// BAJO usa el gris de texto secundario.
val RiesgoCritico = Color(0xFFEF4058)
val RiesgoAlto = Color(0xFFF6A15A)
val RiesgoMedio = Color(0xFFF7BC53)
val RiesgoBajo = Color(0xFF939AA6)
