# ALERVI

```
   ___ _    ___ ___  _   _ ___
  /   | |  | __| _ \| | / /_ _|
 / /| | |_ | _||   /| |/ / | |
/_/ |_|___|___|_|\_\|___/ |___|
 Alerta y Evaluacion de Riesgo Vial
```

> Sistema de priorizacion vial y alerta temprana para la gestion municipal
> y prevencion ciudadana de siniestros viales.

[![CI Backend](https://img.shields.io/badge/CI-Backend-blue)]()
[![CI Web](https://img.shields.io/badge/CI-Web-green)]()
[![CI Mobile](https://img.shields.io/badge/CI-Mobile-purple)]()

---

## <*> Descripcion

ALERVI es una plataforma geoespacial con doble proposito:

1. **Modulo Municipal (DSS):** Dashboard web que clasifica, jerarquiza y explica
   la criticidad de intersecciones viales mediante un Indice de Prioridad (0-100),
   con fichas de inspeccion de terreno.

2. **Modulo Ciudadano:** App Android que visualiza zonas de alto riesgo y genera
   alertas de proximidad para conductores.

**Zona piloto:** San Pedro de la Paz / Gran Concepcion, Chile.

---

## {#} Arquitectura

```
+------------------+     +------------------+
|  API CONASET     |     |  Contexto OSM    |
|  (Siniestros)    |     |  (Colegios, etc) |
+--------+---------+     +--------+---------+
         '------------+------------'
                       v
    +--------------------------------------+
    |   Backend FastAPI + PostGIS          |
    |   Motor de Scoring Espacial          |
    +------------------+-------------------+
                       |
          +------------+------------+
          v                         v
 +-------------------+  +--------------------+
 |  Web Municipal    |  |  App Android       |
 |  (Next.js)        |  |  (Kotlin / Compose)|
 +-------------------+  +--------------------+
```

---

## {%} Stack Tecnologico

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Python 3.12 + FastAPI |
| Base de Datos | PostgreSQL 16 + PostGIS 3.4 |
| Frontend Web | Next.js 14 + TypeScript |
| App Movil | Kotlin + Jetpack Compose |
| Contenedores | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Tests E2E | Playwright |

---

## {>} Guia de Setup Rapido

Esta seccion documenta el proceso paso a paso para levantar el entorno de desarrollo local.
Toda la infraestructura (Base de Datos + API) esta paquetizada en contenedores para garantizar que todo el equipo trabaje en igualdad de condiciones.

### 1. Pre-requisitos del Sistema

Asegurate de tener instalado lo siguiente antes de comenzar:
- **Git** >= 2.30
- **Docker Desktop** (o Docker Engine + Docker Compose Plugin) funcionando y corriendo.
- **Python** >= 3.12 (Solo si deseas ejecutar el backend fuera de Docker)
- **Node.js** >= 20 LTS (Para el frontend municipal)
- **Android Studio** + JDK 17 (Para compilar la App Kotlin)

### 2. Clonar e Inicializar

```bash
# Clonar el repositorio
git clone https://github.com/<org>/alervi.git
cd alervi

# Configurar variables de entorno locales
# (El archivo .env es ignorado por Git por seguridad)
cp .env.example .env
```

### 3. Levantar Infraestructura con Docker

La base de datos (PostgreSQL + PostGIS) y el Backend (FastAPI) arrancan con un solo comando:

```bash
# Levantar servicios en segundo plano (daemon)
docker compose up -d --build

# Verificar que los contenedores esten corriendo (Status: Up / healthy)
docker compose ps
```

### 4. Verificar Servicios

Una vez que los contenedores esten "Up", verifica que todo este sano:

- **Documentacion API (Swagger):** Abre en tu navegador [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check API:** Ejecuta `curl -s http://localhost:8000/health` (Deberia retornar `{"status":"ok",...}`)
- **Base de Datos:** Accesible en `localhost:5432` con las credenciales definidas en tu `.env`.

#### Autenticación y Credenciales de Desarrollo
La API implementa autenticación mediante **Bearer Token (JWT HS256)**:
- `POST /api/v1/auth/login`: Valida correo y contraseña. Devuelve un access token Bearer.
- **Cuentas de prueba (Seed):**
  | Rol | Correo | Contraseña |
  | :--- | :--- | :--- |
  | Administrador | `admin@alervi.test` | `Dev-2026-ALERVI` |
  | Inspector | `inspector@alervi.test` | `Dev-2026-ALERVI` |
- **Rutas protegidas (`Authorization: Bearer <token>`):**
  - **Requieren rol `administrador`:** `/api/v1/usuarios` (CRUD) y `/api/v1/auditoria`.
  - **Requieren usuario autenticado:** `/api/v1/inspections` (creación y actualización de fichas, subida de fotografías).

#### Reglas Clave de la API
- **Ranking Jerarquizado (`/api/v1/ranking`):** Soporta tanto `anio` individual (ej. `?anio=2024`) como rango (`periodo_inicio` y `periodo_fin`). La ordenación se realiza globalmente por Índice de Prioridad (IP) y desempates multicriterio según la regla **RB-7**.
- **Fichas de Inspección (`/api/v1/inspections`):** La `fecha_visita` debe ser una fecha no futura (`<= HOY`, formato `YYYY-MM-DD`, regla **RB-10**).
- **Privacidad y Telemetría (`/api/v1/alerts`):** Jamás se persisten ni registran coordenadas GPS sin procesar en logs técnicos (**RNF-S-8**).

### 5. Comandos Utiles de Operacion

```bash
# Ver logs del backend en tiempo real
docker compose logs -f backend

# Detener los servicios sin borrar datos
docker compose down

# Detener los servicios Y BORRAR la base de datos (Reset total)
docker compose down -v
```

### 6. Calidad de Codigo y Pruebas

#### Pre-commit hooks
Antes de hacer commits, instala los hooks locales:

```bash
pip install pre-commit
pre-commit install
```

#### Backend API (Linter, Formateo y Tests)
El backend cuenta con validación estricta de estilo y pruebas automatizadas (cobertura requerida $\ge 80\%$):

```bash
cd packages/backend-api

# 1. Linter estático (Ruff)
ruff check .

# 2. Formateador de código
ruff format .

# 3. Verificar formateo sin modificar (verificación de CI)
ruff format --check .

# 4. Ejecutar suite de pruebas con reporte de cobertura
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## {+} Estructura del Proyecto

```
alervi/
|
|-- .github/
|   |-- workflows/
|   |   |-- ci-backend.yml            # Lint (Ruff) + Test (pytest) en cada PR
|   |   |-- ci-web.yml                # Lint (ESLint) + Test (Jest) + Build
|   |   |-- ci-mobile.yml             # Build Kotlin + Tests (JUnit)
|   |   '-- e2e-tests.yml             # Playwright E2E (schedule / manual)
|   '-- PULL_REQUEST_TEMPLATE/
|       '-- pull_request_template.md  # Plantilla obligatoria de PRs
|
|-- apps/
|   |-- web-municipal/                # ---- Frontend Web (Next.js 14 + TS) ----
|   |   |-- src/
|   |   |   |-- app/                  # App Router (Next.js)
|   |   |   |-- components/
|   |   |   |   |-- Map/              # Mapa Leaflet / Mapbox
|   |   |   |   |-- Ranking/          # Tabla ranking Top N
|   |   |   |   |-- FichaTerreno/     # Formulario de inspeccion
|   |   |   |   '-- Filters/          # Filtros comuna / anio
|   |   |   |-- hooks/                # Custom hooks React
|   |   |   |-- services/             # Llamadas a la API (fetch / axios)
|   |   |   '-- types/                # Tipos TS importados del contrato
|   |   |-- tests/                    # Jest + Playwright
|   |   '-- public/                   # Assets estaticos
|   |
|   '-- mobile-ciudadano/            # ---- App Android (Kotlin + Compose) ----
|       |-- app/src/
|       |   |-- main/java/cl/alervi/
|       |   |   |-- ui/
|       |   |   |   |-- map/          # MapScreen (Google Maps / Mapbox)
|       |   |   |   |-- alerts/       # AlertListScreen
|       |   |   |   '-- detail/       # PointDetailScreen
|       |   |   |-- data/
|       |   |   |   |-- api/          # Retrofit service
|       |   |   |   '-- repository/   # Repositorio de datos
|       |   |   |-- domain/
|       |   |   |   |-- model/        # Modelos de dominio
|       |   |   |   '-- usecase/      # Casos de uso
|       |   |   |-- location/         # GPS Service (FusedLocationProvider)
|       |   |   '-- di/               # Inyeccion de dependencias (Hilt)
|       |   |-- main/res/             # Recursos Android (layouts, values, drawables)
|       |   |-- test/                 # Tests unitarios (JUnit)
|       |   '-- androidTest/          # Tests instrumentados (Espresso)
|       '-- gradle/                   # Config de Gradle
|
|-- packages/
|   |-- backend-api/                  # ---- Backend (Python + FastAPI) ----
|   |   |-- app/
|   |   |   |-- main.py               # Entry point FastAPI y rutas protegidas
|   |   |   |-- routers/              # Endpoints por dominio
|   |   |   |-- models/               # Modelos SQLAlchemy + GeoAlchemy2
|   |   |   |-- schemas/              # Schemas Pydantic (validacion y contratos)
|   |   |   |-- services/             # Logica de negocio (scoring RB-7, CRUD, PostGIS)
|   |   |   |-- core/                 # Config, pooler BD, seguridad (JWT HS256, RBAC)
|   |   |   '-- utils/                # Helpers
|   |   |-- tests/                    # pytest (cobertura >= 80%, unit + integracion)
|   |   |-- alembic/                  # Migraciones de BD
|   |   '-- Dockerfile
|   |
|   |-- db/                           # ---- Base de Datos ----
|   |   |-- migrations/               # Migraciones Alembic
|   |   |-- seeds/                    # Datos CONASET preprocesados + OSM
|   |   '-- init.sql                  # Schema inicial PostGIS
|   |
|   '-- shared-contracts/            # ---- Contrato (fuente de verdad) ----
|       |-- openapi.yaml              # Especificacion OpenAPI 3.0
|       |-- types/                    # Tipos TypeScript generados
|       '-- README.md                 # Como regenerar tipos desde OpenAPI
|
|-- docs/                             # ---- Entregables academicos ----
|   |-- E1_Avance_Escrito/
|   |-- E2_Revision_Preliminar/
|   |-- E3_Revision_Critica/
|   |-- E4_Informe_Final/
|   |-- E5_Defensa_Final/
|   |-- SRS_IEEE830/                  # Documento de requisitos
|   |-- actas/                        # Actas de reunion
|   |-- validaciones/                 # Instrumentos y datos de validacion
|   |-- adr/                          # Architecture Decision Records
|   '-- diagramas/                    # C4, E-R, UML
|
|-- e2e/                              # ---- Tests End-to-End ----
|   |-- tests/                        # Specs de Playwright
|   '-- playwright.config.ts
|
|-- docker-compose.yml                # PostgreSQL+PostGIS + Backend + Web
|-- .env.example                      # Variables de entorno (plantilla)
|-- .gitignore
|-- CONTRIBUTING.md                   # /!\ LEER ANTES DE CONTRIBUIR
'-- README.md                         # <-- Estas aqui
```

---

## {::} Equipo

| Rol | Responsabilidad |
|-----|----------------|
| Jefe de Proyecto | Gestion + Frontend Web |
| Lider Tecnico | Arquitectura + Backend |
| Lider de Calidad | QA + Tests |
| Lider de Datos y Seguridad | Scoring + BD |
| Lider de Operacion | DevOps + App Movil |

---

## // Convenciones

**Lee [CONTRIBUTING.md](./CONTRIBUTING.md) antes de contribuir.** Define:

- Convencion de commits (Conventional Commits)
- Convencion de ramas (Git Flow)
- Plantilla de Pull Requests
- Politica de revision de codigo

---

## (-) Licencia

Este proyecto es desarrollado como parte de la asignatura Proyecto Informatico,
Ingenieria Civil Informatica. Todos los derechos reservados al equipo de desarrollo.
