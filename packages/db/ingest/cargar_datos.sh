#!/bin/sh
set -e

# Carga los datos de desarrollo

export PGHOST=db PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB"
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB"

# Los cargadores hacen upsert: conservar usuarios no implica que exista geografía.
python ingest/cargar_comuna.py ingest/data/poligono_concepcion.geojson --nombre "Concepción"
python ingest/cargar_conaset.py ingest/data/puntos_conaset_oficial.geojson
python ingest/cargar_osm.py ingest/data/elementos_osm_concepcion.geojson

# Solo catálogos y cuentas locales. Las fichas/fotos de ejemplo requieren carga explícita.
psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -f seeds/001_datos_base.sql
