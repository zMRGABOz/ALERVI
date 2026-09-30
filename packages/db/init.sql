-- ============================================================
--  ALERVI -- Inicializacion de la base de datos
-- ============================================================
--  Este script se ejecuta automaticamente cuando el contenedor
--  de PostgreSQL arranca por primera vez (via docker-entrypoint-initdb.d).
--
--  Las tablas del dominio se crean via Alembic (migraciones),
--  NO en este archivo. Aqui solo van extensiones y configuracion.
-- ============================================================

-- Extensiones geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Extensiones de utilidad
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
