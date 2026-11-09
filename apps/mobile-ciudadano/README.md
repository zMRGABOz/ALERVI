# ALERVI — App ciudadana Android

Aplicación Android ciudadana de ALERVI (ALERVI · Alerta y Evaluación de Riesgo Vial)
para la comuna de Concepción: consulta pública de puntos críticos (RF-2) y alertas
de proximidad sonoras y visuales (RF-8), conforme al E1
y al contrato `alervi/packages/shared-contracts/openapi.yaml`.

## Requisitos

- JDK 17 **completo (JDK, no solo JRE)**. El JRE del sistema no sirve: `hiltJavaCompile`
  falla con «does not provide the required capabilities: [JAVA_COMPILER]». En este
  equipo usar el Temurin que descarga Gradle:
  `export JAVA_HOME=$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2`
  (o cualquier JDK 17 con `javac`).
- Android SDK con platform 35 y build-tools (se descargan automáticamente al compilar si hay licencias aceptadas)

## Product flavors (ejecución 100 % local, sin claves ni servicios de pago)

| Flavor | Comportamiento |
|--------|----------------|
| `mock`  | Funciona **sin backend ni red**: fixtures JSON locales que cumplen `openapi.yaml`. |
| `local` | Consume `http://10.0.2.2:8000` (contenedor FastAPI del repo con `docker compose up`). HTTP cleartext **solo** hacia `10.0.2.2`/`localhost` y **solo en debug** (RNF-S-3). |

## Comandos verificados

```bash
# Desde este directorio (apps/mobile-ciudadano), con JAVA_HOME apuntando a JDK 17:
export JAVA_HOME=$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2

./gradlew :app:assembleMockDebug      # APK flavor mock (demostración sin red)
./gradlew :app:assembleLocalDebug     # APK flavor local (backend en 10.0.2.2:8000)
./gradlew :app:testMockDebugUnitTest  # Pruebas JVM mock (RNF-M-1)
./gradlew :app:testLocalDebugUnitTest # Pruebas JVM local (RNF-M-1)
./gradlew :app:lintMockDebug          # Android Lint (RNF-M-2: 0 errores/fatales)

# Cobertura JaCoCo de lógica propia: informes por flavor + umbral ≥80 % líneas/ramas.
./gradlew :app:verificarCobertura

# Pruebas instrumentadas/E2E (requiere emulador API 34 encendido; ver abajo).
./gradlew :app:connectedMockDebugAndroidTest
```

APK generados:

- `app/build/outputs/apk/mock/debug/app-mock-debug.apk`
- `app/build/outputs/apk/local/debug/app-local-debug.apk`

Informes:

- Cobertura: `app/build/reports/jacoco/jacocoMockDebugReport/` y
  `app/build/reports/jacoco/jacocoLocalDebugReport/` (HTML/XML/CSV).
- Instrumentadas: `app/build/reports/androidTests/connected/debug/flavors/mock/index.html`.

El workflow `.github/workflows/ci-mobile.yml` ejecuta los mismos comandos: build,
pruebas JVM de ambos flavors, lint y umbral de cobertura en un job, y las
instrumentadas en un emulador API 34 en paralelo.

## Ejecución en emulador o dispositivo

El flavor `mock` es el recomendado para la demostración (no requiere backend).

1. Abrir la carpeta `apps/mobile-ciudadano` en Android Studio y esperar la
   sincronización de Gradle.
2. Elegir la variante `mockDebug` en el selector de *build variants* y ejecutar
   en el emulador o dispositivo conectado.
3. Instalación por consola:

   ```bash
   adb install -r app/build/outputs/apk/mock/debug/app-mock-debug.apk
   adb shell am start -n cl.alervi.ciudadano.mock/cl.alervi.ui.MainActivity
   ```

4. Aceptar el consentimiento, pulsar «Activar alertas» y conceder ubicación
   precisa y notificaciones.
5. La app sigue evaluando con la pantalla bloqueada gracias al
   `ServicioAlertasProximidad` (tipo `location`). En el emulador, simular el
   recorrido con `adb emu geo fix <lon> <lat> 10 12 29.16 0`
   (velocidad ≈ 15 m/s hacia el norte; el AVD debe tener `hw.gps=yes`):

   ```bash
   # Punto 101 en (-73.0543, -36.8271). Acercarse desde el sur:
   adb emu geo fix -73.0543 -36.8295 10 12 29.16 0   # ~265 m: TTC > 12 s, sin aviso
   adb emu geo fix -73.0543 -36.8283 10 12 29.16 0   # ~133 m: aviso sonoro + notificación
   ```

   En un teléfono real el GPS requiere movimiento real o una app de ubicación
   simulada de desarrollo; con el dispositivo quieto no se generan avisos
   (velocidad < 1,38 m/s).

## Notas de privacidad (E1 §5.3, Ley 21.719)

- El mapa público **no** solicita permiso de ubicación (§5.3 L837).
- El permiso `ACCESS_FINE_LOCATION` se solicita solo tras el consentimiento informado
  («Activar alertas»); se registra localmente versión del texto + fecha.
- La posición del ciudadano viaja únicamente en el cuerpo JSON de `POST /api/v1/alerts`,
  nunca se almacena localmente ni se escribe en Logcat (RNF-S-8).
- Mapa: MapLibre Native + teselas raster CARTO Positron, con atribución visible de
  OpenStreetMap (REF-10) y CARTO (REF-11). Sin Google Maps SDK ni Mapbox SDK.
