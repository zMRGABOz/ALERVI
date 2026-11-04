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

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
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
            // Backend local del repo (docker compose up): FastAPI en 10.0.2.2:8000.
            buildConfigField("boolean", "MODO_SIN_RED", "false")
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:8000\"")
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

    // Mapa (D-1: MapLibre + CARTO Positron; prohibidos Google Maps/Mapbox)
    implementation(libs.maplibre.android)

    // Pruebas unitarias (RNF-M-1)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
