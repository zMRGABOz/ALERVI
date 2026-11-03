# Data Loader para los datos de CONASET (GeoJSON) a la base de datos

# Lee el GeoJSON
# Valida cada fila y descarta aquellas que no cumplan con ciertos requerimientos
# Fusiona filas con igual coordenada y año

import argparse
import json
import math
import os
import sys

from collections import Counter

import psycopg2
from dotenv import find_dotenv, load_dotenv

ANIO_MIN, ANIO_MAX = 2020, 2025
DECIMALES = 6

# Pareo de columnas del GeoJSON a las columnas de la BD
CAMPOS = {
    "Cantidad_d": "cantidad_siniestros",
    "Fallecidos": "fallecidos",
    "GRAVES": "graves",
    "MENOS_GRAV": "menos_graves",
    "LEVES": "leves",
}


def conectar():
    """
    Abre la conexion con la base de datos.
    Utiliza DATABASE_URL si existe o la construye con las variables de entorno
    """

    # Cargamos el archivo de variables de entorno en la raiz del proyecto
    # load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    load_dotenv(find_dotenv())

    # Extraccion de la DATABASE_URL si existe
    url = os.getenv("DATABASE_URL")

    # Si no existe se construye
    if not url:
        url = "postgresql://{u}:{p}@{h}:{port}/{d}".format(
            u=os.getenv("POSTGRES_USER", "alervi_user"),
            p=os.getenv("POSTGRES_PASSWORD", "alervi_dev_2026"),
            h=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432"),
            d=os.getenv("POSTGRES_DB", "alervi_db"),
        )

    return psycopg2.connect(url)


def get_entero(valor):
    """
    Dado un [valor] devuelve dicho valor como entero o como None si no es un entero valido
    """
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return None
    if isinstance(valor, float) and not valor.is_integer():
        return None
    return int(valor)


def leer_fila(feature):
    """
    Convierte un feature en (lon, lat, anio, conteos).
    Lanza errores si alguno de los datos no es correcto
    """

    # Extraccion de los puntos
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "Point":
        raise ValueError("Geometria distinta de Point")
    lon, lat = geometry["coordinates"][:2]
    if not all(
        isinstance(c, (int, float)) and not isinstance(c, bool) and math.isfinite(c)
        for c in (lon, lat)
    ):
        raise ValueError("Coordenadas invalidas")

    properties = feature.get("properties") or {}

    # Extraccion del año
    anio = get_entero(properties.get("AÑO"))
    if anio is None or not ANIO_MIN <= anio <= ANIO_MAX:
        raise ValueError(f"anio fuera de rango {ANIO_MIN}-{ANIO_MAX}")

    # Extraccion de los conteos
    conteos = {}
    for campo, columna in CAMPOS.items():
        n = get_entero(properties.get(campo))
        if n is None or n < 0:
            raise ValueError(f"{campo} no es un entero >= 0")
        conteos[columna] = n
    if conteos["cantidad_siniestros"] < 1:
        raise ValueError("cantidad_siniestros debe ser >= 1")

    return round(lon, DECIMALES), round(lat, DECIMALES), anio, conteos


def main():
    # Configuracion inicial del argumentparses
    ap = argparse.ArgumentParser(
        description="Carga de datos CONASET (Formato: GeoJSON)"
    )
    ap.add_argument("archivo", help="ruta al GeoJSON")
    ap.add_argument(
        "--dry-run", action="store_true", help="valida y prueba sin guardar nada"
    )
    args = ap.parse_args()

    # Apertura del archivo y carga las features
    with open(args.archivo, encoding="utf-8") as f:
        features = json.load(f)["features"]

    # Conexcion con la base de datos
    conexion = conectar()
    cursor = conexion.cursor()

    # Contador de error y diccionario de filas fusionadas
    rechazos = Counter()
    fusionados = {}

    # Iteracion por cada fila del GeoJSON
    for feature in features:
        try:
            lon, lat, anio, conteos = leer_fila(feature)
        except (ValueError, KeyError, IndexError, TypeError) as e:
            rechazos[str(e)] += 1
            continue

        # Cada punto debe caer dentro de una comuna
        cursor.execute(
            "SELECT EXISTS (SELECT 1 FROM comuna WHERE ST_Within(ST_SetSRID(ST_MakePoint(%s, %s), 4326), geometry))",
            (lon, lat),
        )
        if not cursor.fetchone()[0]:
            rechazos["fuera de comuna"] += 1
            continue

        # Fusion de filas con misma coordenada y año
        clave = (lon, lat, anio)
        if clave in fusionados:
            for col, n in conteos.items():
                fusionados[clave][col] += n
        else:
            fusionados[clave] = dict(conteos)

    ids = {}  # "Cache" de puntos
    for (lon, lat, anio), conteos in fusionados.items():
        # Validacion de la existencia del punto en la cache
        if (lon, lat) not in ids:
            # Si el punto no estan en la cache se intenta insertar en la tabla PUNTO_CRITICO
            # Si el punto ya existia entonces se realiza una dummy update para que la query retorne el punto
            cursor.execute(
                """
                INSERT INTO punto_critico (geometry)
                VALUES (ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                ON CONFLICT (geometry) DO UPDATE SET geometry = EXCLUDED.geometry
                RETURNING id_punto
                """,
                (lon, lat),
            )

            # El punto en cuestion es ingresado a la cache de puntos
            ids[(lon, lat)] = cursor.fetchone()[0]

        # Insercion de filas en la tabla REGISTRO
        # Si el par (id_punto, anio) ya existe se reemplazan los conteos originales por los de la fila actual que se quiere insertar
        # esto permite consistencia en caso de correr el cargador varias veces teniendo la BD ya cargada previamente
        cursor.execute(
            """
            INSERT INTO registro (id_punto, anio, cantidad_siniestros, fallecidos, graves, menos_graves, leves)
            VALUES (%(id_punto)s, %(anio)s, %(cantidad_siniestros)s, %(fallecidos)s, %(graves)s, %(menos_graves)s, %(leves)s)
            ON CONFLICT (id_punto, anio) DO UPDATE SET
                cantidad_siniestros = EXCLUDED.cantidad_siniestros,
                fallecidos          = EXCLUDED.fallecidos,
                graves              = EXCLUDED.graves,
                menos_graves        = EXCLUDED.menos_graves,
                leves               = EXCLUDED.leves
            """,
            {"id_punto": ids[(lon, lat)], "anio": anio, **conteos},
        )

    if args.dry_run:
        conexion.rollback()
    else:
        conexion.commit()
    conexion.close()

    print(f"Filas leidas: {len(features)}")
    print(f"Filas rechazadas: {sum(rechazos.values())}")
    for motivo, n in rechazos.items():
        print(f"    {motivo} : {n}")
    print(f"Puntos distintos: {len(ids)}")
    print(f"Registros (punto, anio): {len(fusionados)}")
    print(
        "MODO PRUEBA: No se guardó nada en la BD"
        if args.dry_run
        else "Guardado en la base de datos"
    )


if __name__ == "__main__":
    sys.exit(main())
