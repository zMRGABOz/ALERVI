# Base de datos ALERVI

PostgreSQL 16 + PostGIS 3.4, ejecutándose en Docker. El esquema sigue el modelo
relacional del SRS (sección 5.1.2).

## Contenido de esta carpeta

| Carpeta | Para qué sirve |
|---|---|
| `migrations/` | Archivos SQL numerados que crean las tablas, índices y permisos. Se aplican en orden |
| `seeds/` | Datos de **desarrollo** en SQL (usuarios ficticios, factores de riesgo y fichas de prueba) |
| `ingest/` | Descargador y cargadores (comuna, siniestros CONASET, colegios y paraderos OSM), sus archivos en `data/` y el script que corre en Docker |

## Cómo ejecutar

```bash
# 1. Crear tu archivo de configuración (solo la primera vez)
cp .env.example .env

# 2. Levantar la base de datos con datos de prueba
docker compose up -d db datos-dev

# 3. Comprobar el estado
docker compose ps -a
```

### Qué esperar

| Servicio | Estado correcto | Qué significa |
|---|---|---|
| `alervi-db` | `Up ... (healthy)` | La base de datos terminó de inicializarse y acepta conexiones |
| `alervi-datos-dev` | `Exited (0)` | Terminó bien su tarea de una sola vez (cargar los datos de prueba). Es normal que no siga corriendo (debería) |

Para ver lo que hizo la carga:

```bash
docker compose logs datos-dev
```

Espera a que `alervi-datos-dev` diga `Exited (0)` antes de
mirar los logs. Deben aparecer, en orden, las secciones de comuna, CONASET, OSM y
seeds. Si el contenedor se levanta de nuevo en los logs dirá: `Datos de desarrollo ya cargados`

### Datos que quedan cargados

### Datos que quedan cargados

| Tabla | Contenido |
|---|---|
| `comuna` | 1 fila (Concepción, `08101`) con el límite administrativo de OpenStreetMap |
| `usuario` | 2 cuentas ficticias |
| `factor_riesgo` | 5 factores iniciales |
| `punto_critico` | 2671 puntos reales de CONASET dentro de la comuna |
| `registro` | 4895 registros (punto y año) |
| `elemento_urbano` | 809 elementos de OSM: 128 colegios y 681 paraderos |
| `ficha_inspeccion`, `registra`, `fotografia` | 4 fichas de prueba sobre los 3 puntos con más siniestros, con 6 factores y 4 fotos. Las rutas de las fotos son ficticias: los archivos no existen |

`evento_auditoria` queda vacía: la llena la API.

Para verificar:

```bash
docker exec alervi-db psql -U alervi_user -d alervi_db -c "SELECT (SELECT count(*) FROM comuna) AS comuna, (SELECT count(*) FROM usuario) AS usuarios, (SELECT count(*) FROM factor_riesgo) AS factores, (SELECT count(*) FROM punto_critico) AS puntos, (SELECT count(*) FROM registro) AS registros, (SELECT count(*) FROM elemento_urbano) AS elementos, (SELECT count(*) FROM ficha_inspeccion) AS fichas, (SELECT count(*) FROM registra) AS registra, (SELECT count(*) FROM fotografia) AS fotos;"
```

Resultado esperado: `1 | 2 | 5 | 2671 | 4895 | 809 | 4 | 6 | 4`.

## Usuarios y contraseñas (solo desarrollo)

Todas las claves de esta sección son de desarrollo. No se reutilizan en producción.

### Usuarios de la base de datos

| Usuario | Contraseña | Para qué |
|---|---|---|
| `alervi_user` | Variable `POSTGRES_PASSWORD` de tu `.env` (por defecto `alervi_dev_2026`) | Dueño de la BD: migraciones y carga de datos. **No lo usa la API** |
| `alervi_app` | Variable `APP_DB_PASSWORD` de tu `.env` (por defecto `alervi_app_dev_2026`) | **Usuario de la API.** Permisos mínimos (ver abajo) |

Permisos de `alervi_app`:

| Tablas | Permisos |
|---|---|
| `comuna`, `punto_critico`, `registro`, `elemento_urbano` | Solo lectura |
| `ficha_inspeccion`, `registra`, `fotografia` | Leer, insertar, modificar y borrar |
| `usuario`, `factor_riesgo` | Leer, insertar y modificar (no borrar) |
| `evento_auditoria` | Solo leer e insertar |

### Cuentas de la aplicación (inician sesión en la web a través de la API)

| Correo | Rol | Contraseña |
|---|---|---|
| `admin@alervi.test` | administrador | `Dev-2026-ALERVI` |
| `inspector@alervi.test` | inspector | `Dev-2026-ALERVI` |

En la base solo se guarda el hash bcrypt de la clave, nunca la clave en texto plano.

> Las contraseñas de la base de datos se asignan **al crear la BD por primera vez**.
> Si cambias `POSTGRES_PASSWORD` o `APP_DB_PASSWORD` en tu `.env` después, no se
> actualizan solas: hay que recrear la BD con `docker compose down -v`.

## Cómo conectarse

| Desde dónde | Host | Puerto |
|---|---|---|
| Tu máquina (psql, DBeaver, una API fuera de Docker, el cargador) | `localhost` | El valor de `POSTGRES_PORT` en tu `.env` (**5432** si no se ha cambiado) |
| Otro contenedor del compose | `db` | `5432` siempre |

Dentro del contenedor PostgreSQL siempre usa el 5432. `POSTGRES_PORT` es el puerto
de **tu máquina**, que Docker redirige al 5432 del contenedor.

Ejemplo de URL desde tu máquina (ajusta el puerto y la clave a tu `.env`):

```
postgresql://alervi_app:alervi_app_dev_2026@localhost:5432/alervi_db
```

Entrar a la consola SQL (dentro del contenedor no pide contraseña):

```bash
docker exec -it alervi-db psql -U alervi_user -d alervi_db
```

### Si el puerto 5432 está ocupado

Si tienes otro PostgreSQL instalado en tu máquina, agrega esto a tu `.env` y vuelve
a levantar:

```
POSTGRES_PORT=5433
```

## Comandos útiles

```bash
# Ver las tablas
docker exec alervi-db psql -U alervi_user -d alervi_db -c "\dt"

# Apagar sin perder datos
docker compose down

# Empezar de cero (BORRA todos los datos y vuelve a cargar los de prueba)
docker compose down -v
docker compose up -d db datos-dev

# Reconstruir el cargador si cambias sus archivos o los seeds
docker compose up -d --build db datos-dev
```

## Cargador de siniestros (CONASET) a mano

## Cargadores a mano

`datos-dev` ejecuta todo en este orden: **comuna → CONASET → OSM → seeds**. El orden
importa: CONASET y OSM usan el polígono de la comuna para descartar lo que cae fuera.
Cada cargador se puede repetir sin duplicar datos y acepta `--dry-run` (prueba sin guardar).

| Script | Qué hace |
|---|---|
| `ingest/descargar_conaset.py` | Descarga los puntos críticos de CONASET (Gran Concepción) a `data/conaset_real.geojson`. Solo se corre a mano y necesita `pip install requests` |
| `ingest/cargar_comuna.py` | Carga el polígono de la comuna en la tabla `comuna` |
| `ingest/cargar_conaset.py` | Valida cada fila, fusiona las de igual coordenada y año, y guarda en `punto_critico` y `registro`. Descarta los puntos fuera de la comuna |
| `ingest/cargar_osm.py` | Guarda en `elemento_urbano` los colegios y paraderos que están dentro de la comuna o a 150 m o menos de su límite |

Requisitos: Python 3.12 o superior y las dependencias de los cargadores:

```bash
pip install -r packages/db/ingest/requirements.txt
```

Ejemplo (la BD debe estar levantada):

```bash
python packages/db/ingest/cargar_comuna.py packages/db/ingest/data/comuna_concepcion.geojson --dry-run
python packages/db/ingest/cargar_conaset.py packages/db/ingest/data/conaset_real.geojson --dry-run
python packages/db/ingest/cargar_osm.py packages/db/ingest/data/osm_bbox_concepcion.geojson --dry-run
```

Los cargadores leen la conexión del `.env` (`POSTGRES_HOST`, `POSTGRES_PORT`,
`POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`) y usan `alervi_user`, porque
`alervi_app` solo puede leer esas tablas.

## Fuentes de los datos

| Dato | Fuente | Fecha de descarga | Licencia |
|---|---|---|---|
| Límite de la comuna | OpenStreetMap, relación 1620105 (`admin_level=8`, código 08101), vía Nominatim | 2026-11-04 | ODbL, © colaboradores de OpenStreetMap |
| Colegios y paraderos | OpenStreetMap (`amenity=school`, `highway=bus_stop`), vía Overpass Turbo | 2026-11-04 | ODbL, © colaboradores de OpenStreetMap |
| Siniestros | CONASET, servicio público ArcGIS `Puntos_criticos_2020_2025` (cuenta `conaset_mtt`) | 2026-11-04 | No declarada por el propietario [Info](https://services3.arcgis.com/vaJl1B5HEzZj7154/arcgis/rest/services/Puntos_criticos_2020_2025/FeatureServer/info/itemInfo?f=pjson) |