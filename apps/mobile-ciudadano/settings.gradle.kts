/*
 * ALERVI — App ciudadana Android (RF-2, RF-8 · E1 §3.2).
 * Arquitectura ALT-1 (E1 §8.1): app nativa Kotlin + Jetpack Compose
 * que consume la API común vía contrato OpenAPI (RD-05, RNF-C-3).
 */
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    // Resolución de toolchains: permite a Gradle descargar un JDK 17 (Temurin) si no
    // está instalado localmente, para compilar con JDK 17 (CONTRIBUTING.md §5)
    // aunque el daemon de Gradle corra sobre otro JDK soportado.
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

rootProject.name = "mobile-ciudadano"
include(":app")
