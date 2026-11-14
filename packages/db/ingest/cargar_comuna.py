# Carga el poligono de la comuna de CONCEPCION en la tabla COMUNA

import argparse
import json
import sys

from cargar_conaset import conectar


def main():
    # Configuracion inicial del argumentparses
    ap = argparse.ArgumentParser(
        description="Carga del poligono de comuna (Formato GeoJSON)"
    )
    ap.add_argument("archivo", help="ruta al GeoJSON")
    ap.add_argument("--nombre", default="Concepcion", help="nombre de la comuna")
    ap.add_argument("--codigo", default="08101", help="codigo de la comuna (5 digitos)")
    ap.add_argument("--dry-run", action="store_true", help="prueba sin guardar nada")
    args = ap.parse_args()

    # Solo es util la geometria del primer feature
    with open(args.archivo, encoding="utf-8") as f:
        geometria = json.load(f)["features"][0]["geometry"]

    conexion = conectar()
    cursor = conexion.cursor()

    # reemplazo del poligono de la comuna
    cursor.execute(
        """
        INSERT INTO comuna (codigo_comuna, nombre, geometry) VALUES
        (%s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
        ON CONFLICT (codigo_comuna) DO UPDATE
            SET nombre = EXCLUDED.nombre, geometry = EXCLUDED.geometry
        RETURNING ST_Area(geometry::geography) / 1e6
        """,
        (args.codigo, args.nombre, json.dumps(geometria)),
    )
    fila = cursor.fetchone()

    if args.dry_run:
        conexion.rollback()
    else:
        conexion.commit()
    conexion.close()

    print("===============")
    print("CARGA DE COMUNA")
    print("===============")

    print(f"Comuna {args.codigo}: Area del poligono = {fila[0]:.1f} km2")
    print(
        "MODO PRUEBA: No se guardó nada en la BD"
        if args.dry_run
        else "Guardado en la base de datos"
    )
    print()


if __name__ == "__main__":
    sys.exit(main())
