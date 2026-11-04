# ALERVI — App ciudadana Android

Aplicación Android ciudadana de ALERVI (ALERVI · Alerta y Evaluación de Riesgo Vial)
para la comuna de Concepción: consulta pública de puntos críticos (RF-2) y alertas
de proximidad sonoras y visuales (RF-8), conforme al E1
y al contrato `alervi/packages/shared-contracts/openapi.yaml`.

## Requisitos

- JDK 17 (`/usr/lib/jvm/java-17-openjdk` o equivalente)
- Android SDK con platform 35 y build-tools (se descargan automáticamente al compilar si hay licencias aceptadas)

## Product flavors (ejecución 100 % local, sin claves ni servicios de pago)

| Flavor | Comportamiento |
|--------|----------------|
| `mock`  | Funciona **sin backend ni red**: fixtures JSON locales que cumplen `openapi.yaml`. |
| `local` | Consume `http://10.0.2.2:8000` (contenedor FastAPI del repo con `docker compose up`). HTTP cleartext **solo** hacia `10.0.2.2`/`localhost` y **solo en debug** (RNF-S-3). |

## Comandos verificados

```bash
# Desde este directorio (apps/mobile-ciudadano), con JAVA_HOME apuntando a JDK 17:
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk

./gradlew :app:assembleMockDebug     # APK flavor mock (demostración sin red)
./gradlew :app:assembleLocalDebug    # APK flavor local (backend en 10.0.2.2:8000)
./gradlew :app:testMockDebugUnitTest # Pruebas unitarias (RNF-M-1)
./gradlew :app:lintMockDebug         # Android Lint (RNF-M-2: 0 errores/fatales)
```

## Notas de privacidad (E1 §5.3, Ley 21.719)

- El mapa público **no** solicita permiso de ubicación (§5.3 L837).
- El permiso `ACCESS_FINE_LOCATION` se solicita solo tras el consentimiento informado
  («Activar alertas»); se registra localmente versión del texto + fecha.
- La posición del ciudadano viaja únicamente en el cuerpo JSON de `POST /api/v1/alerts`,
  nunca se almacena localmente ni se escribe en Logcat (RNF-S-8).
- Mapa: MapLibre Native + teselas raster CARTO Positron, con atribución visible de
  OpenStreetMap (REF-10) y CARTO (REF-11). Sin Google Maps SDK ni Mapbox SDK.
