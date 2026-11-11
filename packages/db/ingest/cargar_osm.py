# Data loader para colegios y paraderos de OSM (GeoJSON)

import argparse
import json
import math
import sys

from collections import Counter

from cargar_conaset import conectar

DECIMALES = 6
MARGEN_METROS = 150

def categoria_de(propiedades):
    """
    Retorna la categoria de la feature (Colegio o Paradero) en base a las etiquetas dadas por OSM
    Retorna None si no corresponde a ninguna
    """
    if propiedades.get("amenity") == "school":
        return "colegio"
    if propiedades.get("highway") == "bus_stop":
        return "paradero"
    return None

def leer_fila(feature):
    """
    Convierte cada feature en un el formato de la tabla para elemento_urbano: (osm_id, osm_tipo, categoria, nombre, lon, lat).
    Lanza error si algun dato no es correcto
    """
    # Extraccion de ID, considerar que el id viene en formato: [tipo/numero]
    try:
        osm_tipo, osm_id = str(feature["id"]).split("/")
        osm_id = int(osm_id)
    except (KeyError, ValueError):
        raise ValueError("ID con formato inseperado")
    if osm_tipo not in ("node", "way", "relation"):
        raise ValueError("Tipo OSM desconocido")

    # Extraccion de las coordenadas
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "Point":
        raise ValueError("Geometria distinta de 'Point'")
    lon, lat = geometry["coordinates"][:2]
    if not all(isinstance(c, (int, float)) and not isinstance(c, bool) and math.isfinite(c) for c in (lon,lat)):
        raise ValueError("Coordenadas invalidas")

    # Extraccion de categoria y nombre
    propiedades = feature.get("properties") or {}
    categoria = categoria_de(propiedades)
    if categoria is None:
        raise ValueError("Sin etiqueta de colegio ni paradero")
    nombre = (propiedades.get("name") or "").strip() or None

    return osm_id, osm_tipo, categoria, nombre, round(lon, DECIMALES), round(lat, DECIMALES)

def main():
    ap = argparse.ArgumentParser(description="Carga de Colegios y paraderos de OSM (Formato GeoJSON)")
    ap.add_argument("archivo", help="ruta al GeoJSON")
    ap.add_argument("--dry-run", action="store_true", help="valida y prueba sin guardar nada")
    args = ap.parse_args()

    with open(args.archivo, encoding="utf-8") as f:
        features = json.load(f)["features"]

    # Diccionario de filas validas
    filas = {}
    rechazos = Counter()

    for feature in features:
        try:
            fila = leer_fila(feature)
        except (ValueError, KeyError, IndexError, TypeError) as e:
            rechazos[str(e)] += 1
            continue
        filas[(fila[0], fila[1])] = fila

    conexion = conectar()
    cursor = conexion.cursor()

    insertados = Counter()
    fuera = 0

    for osm_id, osm_tipo, categoria, nombre, lon, lat in filas.values():
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM comuna WHERE ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            )
            """,
            (lon, lat, MARGEN_METROS)
        )

        if not cursor.fetchone()[0]:
            fuera += 1
            continue

        cursor.execute(
            """
            INSERT INTO elemento_urbano (osm_id, osm_tipo, categoria, nombre, geometry) VALUES
            (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            ON CONFLICT (osm_id, osm_tipo) DO UPDATE SET
                categoria = EXCLUDED.categoria,
                nombre = EXCLUDED.nombre,
                geometry = EXCLUDED.geometry
            """,
            (osm_id, osm_tipo, categoria, nombre, lon, lat)
        )
        insertados[categoria] += 1

    if args.dry_run:
        conexion.rollback()
    else:
        conexion.commit()
    conexion.close()

    print("==================")
    print("CARGA DE DATOS OSM")
    print("==================")

    print(f"Elementos leidos: {len(features)}")
    print(f"Elementos rechazados: {sum(rechazos.values())}")
    for motivo, n in rechazos.items():
        print(f"    {motivo} : {n}")
    print(f"Elementos validos: {len(filas)}")
    print(f"Fuera de la comuna (a mas de {MARGEN_METROS} m de su limite): {fuera}")
    print(f"Elementos guardados: {sum(insertados.values())}")
    for categoria, n in insertados.items():
        print(f"    {categoria} : {n}")
    print("MODO PRUEBA: No se guardó nada en la BD" if args.dry_run else "Guardado en la base de datos")
    print("")

if __name__ == "__main__":
    sys.exit(main())