#!/bin/sh

# Carga los datos de desarrollo

export PGHOST=db PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB"
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB"

if [ "$(psql -tAc 'SELECT count(*) FROM usuario')" != "0" ]; then
    echo "Datos de desarrollo ya cargados. Para recargar limpiar la BD: docker compose down -v"
    exit 0
fi

for f in seeds/*.sql; do
    echo "Aplicando $f"
    psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -f "$f" || exit 1
done

python ingest/cargar_conaset.py ingest/data/conaset_sintetico.geojson