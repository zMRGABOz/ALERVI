# Descarga puntos criticos de CONASET dentro de bbox definida (Concepción)

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import requests

ENDPOINT = "https://services3.arcgis.com/vaJl1B5HEzZj7154/arcgis/rest/services/Puntos_criticos_2020_2025/FeatureServer/0/query"

BBOX = "-73.0915891, -36.9268099, -72.8446184, -36.7644238"
TAMANIO_PAGINA = 2000
MAX_PAGINAS = 50
CAMPO_ORDEN = "FID"

RUTA_SALIDA = Path(__file__).parent / "data" / "conaset.geojson"


def descargar_conaset():

    params = {
        "where": "1=1",
        "geometry": BBOX,
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
        "orderByFields": CAMPO_ORDEN,
        "resultRecordCount": TAMANIO_PAGINA,
    }

    features = []
    paginas = 0

    while paginas <= MAX_PAGINAS:
        params["resultOffset"] = len(features)

        respuesta = requests.get(ENDPOINT, params=params, timeout=60)
        respuesta.raise_for_status()
        datos = respuesta.json()

        if "error" in datos:
            raise RuntimeError(f"La API respondio con un error: {datos['error']}")

        pagina = datos.get("features", [])
        if not pagina:
            return features, paginas

        features.extend(pagina)
        paginas += 1

    raise RuntimeError(f"Se alcanzó el maximo de paginas: {MAX_PAGINAS}")


def main():
    ap = argparse.ArgumentParser(
        description="Descarga de puntos criticos de CONASET (Formato GeoJSON)"
    )
    ap.add_argument("--salida", default=RUTA_SALIDA, help="ruta del GeoJSON de salida")
    args = ap.parse_args()

    try:
        features, paginas = descargar_conaset()
    except (requests.RequestException, RuntimeError) as e:
        sys.exit(f"Descarfa fallida: {e}")

    if not features:
        sys.exit("La API no retornó ningun registro")

    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(
            {"type": "FeatureCollection", "features": features}, f, ensure_ascii=False
        )

    propiedades = [ft.get("properties") or {} for ft in features]
    ids = [p["FID"] for p in propiedades if p.get("FID") is not None]
    por_anio = Counter(p.get("AÑO") for p in propiedades)

    print(f"Fecha de descarga: {date.today()}")
    print(f"Paginas con datos: {paginas}")
    print(f"Registros descargados: {len(features)}")
    print(f"Registros sin FID: {len(features) - len(ids)}")
    print(f"FID repetidos: {len(ids) - len(set(ids))}")
    print(
        f"Registros sin geometria: {sum(1 for ft in features if not ft.get('geometry'))}"
    )
    print("Registros por año:")
    for anio, n in sorted(por_anio.items(), key=lambda x: str(x[0])):
        print(f"    {anio} : {n}")
    print(f"Archivos guardados en: {args.salida}")


if __name__ == "__main__":
    sys.exit(main())
