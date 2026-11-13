import java.util.Properties
import org.gradle.testing.jacoco.tasks.JacocoCoverageVerification
import org.gradle.testing.jacoco.tasks.JacocoReport

/*
 * Módulo app — ALERVI ciudadano.
 *
 * Compatibilidad (RNF-C-2, E1 §4.5): Android 9.0 (API 28) a Android 15 (API 35).
 * JDK 17 (CONTRIBUTING.md §5: Android Studio + JDK 17).
 *
 * Flavors de producto (ejecución 100 % local, RD-01):
 *  - mock : funciona sin backend ni red, con fixtures JSON locales que cumplen openapi.yaml.
 *  - local: consume http://10.0.2.2:8000 (contenedor FastAPI vía `docker compose up`),
 *           con HTTP cleartext SOLO hacia 10.0.2.2/localhost y solo en debug (RNF-S-3).
 */
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    jacoco
}

android {
    namespace = "cl.alervi"
    compileSdk = 35 // RNF-C-2: compatible hasta Android 15 (API 35)

    defaultConfig {
        applicationId = "cl.alervi.ciudadano"
        minSdk = 28 // RNF-C-2: Android 9.0 o superior
        targetSdk = 35 // RNF-C-2
        versionCode = 1
        versionName = "0.1.0"

        // HiltTestApplication + pruebas de Compose en emulador.
        testInstrumentationRunner = "cl.alervi.HiltTestRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // RNF-S-8 + RNF-S-3: la posición del ciudadano jamás se escribe en Logcat.
    // NO se declara OkHttp logging-interceptor por diseño (RNF-S-8, E1 §4.3).
    // JDK 17 de compilación vía toolchain (CONTRIBUTING.md §5).
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        debug {
            // Instrumentación JaCoCo (RNF-M-1) para medir las pruebas
            // unitarias JVM de la lógica propia (domain, data, viewmodels).
            enableUnitTestCoverage = true
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    fun resolverBaseUrlLocal(): String {
        val propGradle = project.findProperty("alervi.backend.url") as? String
        if (!propGradle.isNullOrBlank()) {
            return if (propGradle.endsWith("/")) propGradle else "$propGradle/"
        }
        val posiblesArchivos =
            listOf(
                rootProject.file("local.properties"),
                project.file("local.properties"),
                rootProject.file("../local.properties"),
                rootProject.file("../../local.properties"),
            )
        for (archivo in posiblesArchivos) {
            if (archivo.exists()) {
                val props = Properties()
                archivo.inputStream().use { props.load(it) }
                val propLocal = props.getProperty("alervi.backend.url")
                if (!propLocal.isNullOrBlank()) {
                    return if (propLocal.endsWith("/")) propLocal else "$propLocal/"
                }
            }
        }
        return "http://10.0.2.2:8000/"
    }

    flavorDimensions += "entorno"
    productFlavors {
        create("mock") {
            dimension = "entorno"
            applicationIdSuffix = ".mock"
            versionNameSuffix = "-mock"
            // 100 % sin red: fixtures JSON locales que cumplen openapi.yaml.
            buildConfigField("boolean", "MODO_SIN_RED", "true")
            buildConfigField("String", "BASE_URL", "\"\"")
        }
        create("local") {
            dimension = "entorno"
            applicationIdSuffix = ".local"
            versionNameSuffix = "-local"
            // Backend local del repo (docker compose up): configurable dinámicamente vía
            // propiedad Gradle -Palervi.backend.url o local.properties con fallback a 10.0.2.2 (RD-04, RNF-S-3).
            val urlBackendLocal = resolverBaseUrlLocal()
            buildConfigField("boolean", "MODO_SIN_RED", "false")
            buildConfigField("String", "BASE_URL", "\"$urlBackendLocal\"")
        }
    }

    // RNF-M-2: Android Lint con 0 errores/fatales en CI (abortOnError por defecto).
    lint {
        abortOnError = true
        warningsAsErrors = false
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    // Toolchain JDK 17 (CONTRIBUTING.md §5). Gradle la descarga si no existe localmente.
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.core.ktx)

    // Jetpack Compose (ALT-1, E1 §8.1)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    // Hilt (abstracción de repositorios Mock vs Remote)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Red + serialización (contrato openapi.yaml, RNF-C-3)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)

    // Persistencia local mínima (consentimiento Ley 21.719 §5.3 y caché de puntos
    // públicos R-8; jamás coordenadas del ciudadano: RNF-S-8)
    implementation(libs.androidx.datastore.preferences)

    // Ubicación en segundo plano de la sesión de alertas (RF-8, RB-13):
    // FusedLocationProviderClient dentro de un ForegroundService (RD-04).
    implementation(libs.play.services.location)

    // Mapa (D-1: MapLibre + CARTO Positron; prohibidos Google Maps/Mapbox)
    implementation(libs.maplibre.android)

    // Pruebas unitarias (RNF-M-1)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.mockwebserver)

    // Pruebas instrumentadas (Hilt + Compose UI Test, emulador API 34).
    // HiltTestRunner usa HiltTestApplication y los módulos @TestInstallIn
    // sustituyen persistencia y fuente de ubicación por dobles en memoria.
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.test.core.ktx)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.hilt.android.testing)
    androidTestImplementation(libs.kotlinx.coroutines.test)
    kspAndroidTest(libs.hilt.compiler)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

// ---------------------------------------------------------------------------
// Cobertura JaCoCo de la lógica propia (RNF-M-1)
// ---------------------------------------------------------------------------
//
// Alcance: domain/** (reglas RB-13/RB-14, proyección UTM, modelos), data/**
// (mapeadores, repositorios remotos y caché), ui/viewmodel (Mapa/Detalle),
// ui/util (formatos chilenos) y location/BusAvisos. Se excluyen:
//  - clases generadas por Hilt/KSP, BuildConfig y recursos R;
//  - UI declarativa Compose (pantallas, componentes, tema, navegación) y
//    MainActivity, verificadas por pruebas instrumentadas;
//  - glue de Android que exige framework/emulador (ServicioAlertasProximidad,
//    ClienteUbicacion, ReproductorAvisos) y AppViewModel, que orquesta el FGS
//    y el contrato de permisos: se cubre con TC-22/23/27/28/29 instrumentados;
//  - DI (módulos sin lógica de negocio).
// El informe se genera por flavor para conservar evidencia separada.
jacoco {
    toolVersion = "0.8.12"
}

val exclusionesCobertura =
    listOf(
        "**/R.class",
        "**/R$*.class",
        "**/BuildConfig.*",
        "**/di/**",
        "**/hilt_aggregated_deps/**",
        "**/dagger/**",
        "**/*_Factory.class",
        "**/*_Factory$*",
        "**/*_MembersInjector.class",
        "**/*_HiltComponents*",
        "**/Hilt_*",
        "**/*_Impl.class",
        "**/*\$serializer*",
        "**/AlerviApp*",
        "**/ui/MainActivity*",
        "**/ui/MainActivityKt*",
        "**/ComposableSingletons*",
        "**/ui/navigation/**",
        "**/ui/pantallas/**",
        "**/ui/components/**",
        "**/ui/theme/**",
        "**/ui/viewmodel/AppViewModel*",
        "**/location/ClienteUbicacion*",
        "**/location/ServicioAlertasProximidad*",
        "**/location/ReproductorAvisos*",
        // Consulta del permiso del sistema: glue de Android cubierto por TC-27
        // instrumentado, no por pruebas JVM.
        "**/location/VerificadorPermiso*",
        // Interfaces Retrofit y sus DefaultImpls: contrato sin lógica propia.
        "**/data/api/*Api*",
    )

fun registrarCobertura(
    sufijo: String,
    flavor: String,
    tareaPruebas: String,
) {
    val directoriosClases =
        project
            .files(
                project.layout.buildDirectory.dir("tmp/kotlin-classes/${flavor}Debug"),
                project.layout.buildDirectory.dir("intermediates/javac/${flavor}Debug/classes"),
            ).map { directorio ->
                project.fileTree(directorio) { exclude(exclusionesCobertura) }
            }

    val fuentes =
        project.files(
            "src/main/java",
            "src/$flavor/java",
        )

    val ejecucion =
        project.fileTree(
            project.layout.buildDirectory.dir("outputs/unit_test_code_coverage/${flavor}DebugUnitTest"),
        ) { include("**/*.exec") }

    tasks.register<JacocoReport>("jacoco${sufijo}Report") {
        group = "verification"
        description = "Cobertura JaCoCo de lógica propia ($flavor) — RNF-M-1."
        dependsOn(tareaPruebas)
        classDirectories.setFrom(directoriosClases)
        sourceDirectories.setFrom(fuentes)
        executionData.setFrom(ejecucion)
        reports {
            xml.required.set(true)
            html.required.set(true)
            csv.required.set(true)
        }
    }

    // Umbral RNF-M-1: ≥80 % de líneas y de ramas sobre la lógica propia incluida.
    tasks.register<JacocoCoverageVerification>("jacoco${sufijo}Verificacion") {
        group = "verification"
        description = "Umbral de cobertura ≥80 % líneas/ramas ($flavor) — RNF-M-1."
        dependsOn(tareaPruebas)
        classDirectories.setFrom(directoriosClases)
        sourceDirectories.setFrom(fuentes)
        executionData.setFrom(ejecucion)
        violationRules {
            rule {
                limit {
                    counter = "LINE"
                    value = "COVEREDRATIO"
                    minimum = "0.80".toBigDecimal()
                }
                limit {
                    counter = "BRANCH"
                    value = "COVEREDRATIO"
                    minimum = "0.80".toBigDecimal()
                }
            }
        }
    }
}

registrarCobertura(
    sufijo = "MockDebug",
    flavor = "mock",
    tareaPruebas = "testMockDebugUnitTest",
)

registrarCobertura(
    sufijo = "LocalDebug",
    flavor = "local",
    tareaPruebas = "testLocalDebugUnitTest",
)

tasks.register("verificarCobertura") {
    group = "verification"
    description = "Genera informes y verifica el umbral ≥80 % en ambos flavors."
    dependsOn(
        "jacocoMockDebugReport",
        "jacocoMockDebugVerificacion",
        "jacocoLocalDebugReport",
        "jacocoLocalDebugVerificacion",
    )
}
