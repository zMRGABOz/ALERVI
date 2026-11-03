-- ============================================================
--  ALERVI -- Migracion 001: datos geoespaciales
-- ============================================================

-- Crea las tablas: comuna, punto_critico, registro, elemento_urbano

BEGIN;

-- PostGIS agrega el tipo [geometry] y las funciones espaciales
CREATE EXTENSION IF NOT EXISTS postgis;

-- COMUNA
-- Poligono de la comuna
-- Los puntos no guardan la comuna a la que pertenecen, se calcula mediante una consulta espacial
CREATE TABLE comuna (
    codigo_comuna text PRIMARY KEY CHECK (codigo_comuna ~ '^[0-9]{5}$'),
    nombre        text NOT NULL UNIQUE,
    geometry      geometry(MultiPolygon, 4326) NOT NULL CHECK (ST_IsValid(geometry))
);

-- PUNTO_CRITICO
-- Un lugar unico por coordenada
CREATE TABLE punto_critico (
    id_punto integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    geometry geometry(Point, 4326) NOT NULL UNIQUE
);

-- Indice espacial, util para las consultas de cercania
CREATE INDEX idx_punto_critico_geometry ON punto_critico USING GIST (geometry);

-- REGISTRO
-- Conteo de siniestros de un punto en un anio
-- Clave primaria compuesta (id_punto, anio)
CREATE TABLE registro (
    id_punto            integer NOT NULL REFERENCES punto_critico (id_punto),
    anio                smallint NOT NULL CHECK (anio BETWEEN 2020 AND 2025),
    cantidad_siniestros integer NOT NULL CHECK (cantidad_siniestros >= 1),
    fallecidos          integer NOT NULL CHECK (fallecidos >= 0),
    graves              integer NOT NULL CHECK (graves >= 0),
    menos_graves        integer NOT NULL CHECK (menos_graves >= 0),
    leves               integer NOT NULL CHECK (leves >= 0),
    PRIMARY KEY (id_punto, anio)
);

-- ELEMENTO URBANO

-- Enum para las categorias 
CREATE TYPE categoria_urbana AS ENUM ('colegio', 'paradero');

CREATE TABLE elemento_urbano (
    id_elemento integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    osm_id      bigint NOT NULL,
    osm_tipo    text NOT NULL CHECK (osm_tipo IN ('node', 'way', 'relation')),
    categoria   categoria_urbana NOT NULL,
    nombre      text,
    geometry    geometry(Point, 4326) NOT NULL,
    UNIQUE (osm_id, osm_tipo)
);

CREATE INDEX idx_elemento_urbano_geometry ON elemento_urbano USING GIST (geometry);

COMMIT;