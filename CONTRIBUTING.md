# // Guia de Contribucion -- ALERVI

```
  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  |C|O|N|T|R|I|B|U|T|I|N|G|.|m|d|
  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

> **Alerta y Evaluacion de Riesgo Vial**
>
> Este documento define las convenciones obligatorias para todo el equipo.
> Leelo completo antes de hacer tu primer commit.

---

## 1. Convencion de Ramas (Branch Naming)

Todas las ramas parten desde `develop`. **Nunca** se trabaja directamente en `main` ni en `develop`.

### Formato

```
<tipo>/<id-issue>-<descripcion-corta>
```

### Tipos de rama

| Prefijo | Uso | Ejemplo |
|---------|-----|---------|
| `feature/` | Nueva funcionalidad | `feature/12-mapa-leaflet-dashboard` |
| `fix/` | Correccion de bug | `fix/34-ranking-null-pointer` |
| `hotfix/` | Fix urgente en produccion (parte de `main`) | `hotfix/crash-login-produccion` |
| `docs/` | Solo documentacion (informes, SRS, actas) | `docs/E1-seccion-requisitos` |
| `test/` | Solo tests nuevos o mejora de tests | `test/42-scoring-unit-tests` |
| `refactor/` | Reestructuracion sin cambio funcional | `refactor/backend-modularizar-routers` |
| `chore/` | Configuracion, CI/CD, dependencias | `chore/setup-github-actions-ci` |
| `spike/` | Investigacion o prueba de concepto | `spike/postgis-spatial-queries` |

### Reglas

- Usar **kebab-case** (minusculas separadas por guiones): `feature/12-mapa-leaflet`
- Incluir el **numero de issue** de GitHub cuando exista: `feature/12-...`
- Maximo **5 palabras** en la descripcion
- **No** usar caracteres especiales, tildes ni espacios

### Flujo de ramas

```
main <-- (solo merges de develop, versionados)
  |
  '-- develop <-- (rama de integracion)
        |
        |-- feature/12-mapa-leaflet-dashboard
        |-- feature/15-endpoint-ranking
        |-- fix/34-ranking-null-pointer
        |-- docs/E1-seccion-requisitos
        '-- test/42-scoring-unit-tests
```

---

## 2. Convencion de Commits (Conventional Commits)

Usamos [Conventional Commits v1.0.0](https://www.conventionalcommits.org/).

### Formato

```
<tipo>(<alcance>): <descripcion imperativa>

[cuerpo opcional]

[pie opcional]
```

### Tipos permitidos

| Tipo | Cuando usarlo | Ejemplo |
|------|---------------|---------|
| `feat` | Nueva funcionalidad visible para el usuario | `feat(ranking): agregar filtro por comuna` |
| `fix` | Correccion de bug | `fix(scoring): corregir division por cero en normalizacion` |
| `docs` | Solo documentacion | `docs(E1): redactar seccion de requisitos funcionales` |
| `test` | Agregar o modificar tests | `test(scoring): agregar tests unitarios para indice de prioridad` |
| `refactor` | Cambio de codigo sin cambio funcional | `refactor(api): extraer logica de scoring a servicio` |
| `style` | Formato, espacios, puntos y comas (no logica) | `style(web): aplicar prettier a componentes` |
| `chore` | Tareas de mantenimiento, CI, dependencias | `chore(ci): configurar workflow de pytest en GitHub Actions` |
| `build` | Cambios en build o dependencias | `build(mobile): actualizar gradle a 8.5` |
| `perf` | Mejora de rendimiento | `perf(db): agregar indice GIST a geometrias` |
| `ci` | Cambios en CI/CD | `ci: agregar step de linting con Ruff` |
| `revert` | Revertir un commit anterior | `revert: revert feat(ranking) commit abc1234` |

### Alcances (scopes) definidos

| Scope | Componente |
|-------|-----------|
| `api` | Backend FastAPI (`packages/backend-api/`) |
| `web` | Frontend Web Next.js (`apps/web-municipal/`) |
| `mobile` | App Kotlin (`apps/mobile-ciudadano/`) |
| `db` | Base de datos, migraciones, seeds (`packages/db/`) |
| `contracts` | Contratos compartidos (`packages/shared-contracts/`) |
| `scoring` | Algoritmo de Indice de Prioridad |
| `ranking` | Funcionalidad de ranking Top N |
| `mapa` | Componentes de mapa (web o movil) |
| `ci` | GitHub Actions, Docker |
| `e2e` | Tests end-to-end Playwright |
| `E1`, `E2`, `E3`, `E4`, `E5` | Entregables del curso |

### Reglas del commit

1. **Descripcion en imperativo** y en espanol: "agregar", "corregir", "eliminar" (no "agregado", "se corrigio")
2. **Primera linea <= 72 caracteres**
3. **Cuerpo opcional**: explicar el *por que*, no el *que* (el codigo ya dice el que)
4. **Pie opcional**: referenciar issues con `Closes #12` o `Refs #15`
5. **Un commit = un cambio logico**. No mezclar feat + fix en un mismo commit

### Ejemplos completos

```
feat(scoring): implementar calculo de indice de prioridad

Se implementa la formula IP = w1*S + w2*F + w3*T + w4*C donde:
- S: severidad normalizada (fallecidos peso 5, graves peso 3, leves peso 1)
- F: frecuencia acumulada 2020-2025
- T: tendencia temporal (pendiente regresion lineal)
- C: contexto urbano (proximidad a colegios, paraderos)

Los pesos w1-w4 son configurables via variables de entorno.

Closes #8
```

```
fix(mobile): corregir crash al solicitar permisos GPS en Android 14

Android 14 requiere ACCESS_FINE_LOCATION antes de ACCESS_BACKGROUND_LOCATION.
Se reordena la secuencia de solicitud de permisos.

Fixes #27
```

```
docs(E1): redactar analisis legal de datos personales

Incluye analisis de Ley 19.628 y Ley 21.719, principio de minimizacion
aplicado y procedimiento de atencion de derechos ARCO.

Refs #5
```

---

## 3. Convencion de Pull Requests

### Formato del titulo

```
[<COMPONENTE>] <tipo>: <descripcion>
```

Donde `COMPONENTE` es uno de: `BACKEND`, `WEB`, `MOBILE`, `DB`, `DOCS`, `CI`, `E2E`, `CONTRACTS`, `GENERAL`.

### Ejemplos de titulos

```
[BACKEND] feat: endpoint GET /ranking con filtro por comuna
[MOBILE] fix: crash en permisos GPS Android 14
[WEB] feat: componente de mapa Leaflet con capa de calor
[DOCS] docs: seccion de requisitos funcionales E1
[CI] chore: workflow de pytest en GitHub Actions
[DB] feat: script de ingesta masiva de datos CONASET
```

### Plantilla del cuerpo del PR

Todo PR debe incluir:

```markdown
## Descripcion
<!-- Que hace este PR y por que -->

## Tipo de cambio
- [ ] feat: nueva funcionalidad
- [ ] fix: correccion de bug
- [ ] docs: documentacion
- [ ] test: tests
- [ ] refactor: reestructuracion
- [ ] chore: mantenimiento

## Componente(s) afectado(s)
- [ ] Backend (FastAPI)
- [ ] Web (Next.js)
- [ ] Mobile (Kotlin)
- [ ] Base de datos
- [ ] Contratos (OpenAPI)
- [ ] CI/CD
- [ ] Documentacion

## Como se probo?
<!-- Describe las pruebas que realizaste -->

## Checklist
- [ ] Mi codigo sigue las convenciones de este proyecto
- [ ] He realizado self-review de mi codigo
- [ ] He comentado el codigo donde es necesario
- [ ] Los tests pasan localmente
- [ ] No hay warnings nuevos de linting

## Screenshots (si aplica)
<!-- Capturas de pantalla de cambios visuales -->

## Issue relacionado
<!-- Closes #XX o Refs #XX -->
```

### Reglas de los Pull Requests

1. **Todo cambio entra via PR** -- prohibido push directo a `main` o `develop`
2. **Minimo 1 reviewer** debe aprobar antes del merge
3. **Los checks de CI deben pasar** (lint + tests) antes de poder hacer merge
4. **Squash merge** para features (un commit limpio en develop)
5. **No auto-mergear**: esperar la revision del companero
6. **Tamano razonable**: un PR no debe tocar mas de ~400 lineas. Si es mas grande, dividirlo
7. **Descripcion obligatoria**: un PR sin descripcion sera rechazado

### Asignacion de reviewers

| Autor del PR | Reviewer sugerido |
|-------------|------------------|
| Jefe de Proyecto (Web) | Lider Tecnico o Lider de Calidad |
| Lider Tecnico (Backend) | Lider de Datos o Lider de Operacion |
| Lider de Calidad (Tests) | Lider Tecnico |
| Lider de Datos (Scoring/DB) | Lider Tecnico o Lider de Calidad |
| Lider de Operacion (Mobile/DevOps) | Lider Tecnico o Lider de Calidad |

---

## 4. Proteccion de Ramas

### `main`
- `[-]` Push directo prohibido
- `[+]` Solo merges desde `develop` via PR
- `[+]` Requiere 2 aprobaciones
- `[+]` CI debe pasar

### `develop`
- `[-]` Push directo prohibido
- `[+]` Merges desde ramas `feature/*`, `fix/*`, `docs/*`, etc.
- `[+]` Requiere 1 aprobacion
- `[+]` CI debe pasar

---

## 5. Setup Rapido del Proyecto

### Pre-requisitos
- Git >= 2.30
- Docker Desktop
- Python >= 3.12
- Node.js >= 20 LTS
- Android Studio + JDK 17

### Clonar y levantar

```bash
# 1. Clonar
git clone https://github.com/<org>/alervi.git
cd alervi

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar servicios con Docker
docker-compose up -d

# 4. Verificar que todo funciona
# Backend:  http://localhost:8000/docs
# Web:      http://localhost:3000
# BD:       localhost:5432
```

### Crear una rama para trabajar

```bash
# Siempre partir desde develop actualizado
git checkout develop
git pull origin develop

# Crear tu rama
git checkout -b feature/12-mapa-leaflet-dashboard

# Trabajar, commitear...
git add .
git commit -m "feat(web): agregar componente de mapa Leaflet base"

# Subir y crear PR
git push -u origin feature/12-mapa-leaflet-dashboard
# --> Ir a GitHub y crear el Pull Request
```

---

*Ultima actualizacion: 2026-09-30*
