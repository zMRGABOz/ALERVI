# Base de datos ALERVI

PostgreSQL 16 + PostGIS 3.4, ejecutándose en Docker. El esquema sigue el modelo
relacional del SRS (sección 5.1.2).

## Contenido de esta carpeta

| Carpeta | Para qué sirve |
|---|---|
| `migrations/` | Archivos SQL numerados que crean las tablas, índices y permisos. Se aplican en orden |
| `seeds/` | Datos de **desarrollo** en SQL (comuna provisoria, usuarios ficticios, factores de riesgo) |
| `ingest/` | Cargador de siniestros CONASET (GeoJSON), datos sintéticos de prueba y el script que corre en Docker |

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

Debe mostrar el resumen del cargador (12 filas leídas, 3 rechazadas a propósito,
6 puntos y 8 registros guardados). Si lo levantas de nuevo, dirá
`Datos de desarrollo ya cargados` y no repetirá nada.

### Datos que quedan cargados

| Tabla | Contenido |
|---|---|
| `comuna` | 1 fila (Concepción) con un **rectángulo provisorio**, no el límite oficial |
| `usuario` | 2 cuentas ficticias |
| `factor_riesgo` | 5 factores iniciales |
| `punto_critico` | 6 puntos sintéticos |
| `registro` | 8 registros sintéticos (punto y año) |

Quedan **vacías**: `elemento_urbano`, `ficha_inspeccion`, `registra`, `fotografia`
y `evento_auditoria`.

Para verificar:

```bash
docker exec alervi-db psql -U alervi_user -d alervi_db -c "SELECT (SELECT count(*) FROM usuario) AS usuarios, (SELECT count(*) FROM factor_riesgo) AS factores, (SELECT count(*) FROM comuna) AS comunas, (SELECT count(*) FROM punto_critico) AS puntos, (SELECT count(*) FROM registro) AS registros;"
```

Resultado esperado: `2 | 5 | 1 | 6 | 8`.

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

El servicio `datos-dev` ya carga los datos sintéticos automáticamente. Esta sección
es solo para ejecutar el cargador manualmente, por ejemplo con un archivo real.

El script `ingest/load_conaset.py` lee un GeoJSON, valida cada fila, fusiona las que
tienen igual coordenada y año (sumando los conteos) y guarda en `punto_critico` y
`registro`. Se puede repetir sin duplicar datos.

Requisitos: Python 3.12 o superior (el comando es `python` o `python3`, según tu
sistema) y las dependencias del cargador:

```bash
pip install -r packages/db/ingest/requirements.txt
```

Ejecución (la BD debe estar levantada):

```bash
# Probar sin guardar nada
python packages/db/ingest/load_conaset.py packages/db/ingest/data/conaset_sintetico.geojson --dry-run

# Guardar
python packages/db/ingest/load_conaset.py packages/db/ingest/data/conaset_sintetico.geojson
```

El script necesita saber a qué base de datos conectarse. Esos datos los lee de tu
archivo `.env` (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` y
`POSTGRES_PASSWORD`), por lo que no hay que escribir ninguna clave en el comando.
Se conecta con el usuario `alervi_user`, porque `alervi_app` solo puede leer esas tablas.

## Pendiente

- Polígono oficial de la comuna (hoy es un rectángulo provisorio).
- Carga de los datos reales de CONASET.
- Carga de colegios y paraderos desde OpenStreetMap (`elemento_urbano`).
- Base de datos compartida en la nube (Supabase).