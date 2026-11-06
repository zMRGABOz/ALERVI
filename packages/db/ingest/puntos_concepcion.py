import json
import requests
import time
import os

# ==============================================================================
# SCRIPT DE EXTRACCIÓN DE DATOS Y MÉTRICAS (CONASET) - PROYECTO SIPROV
# ==============================================================================
# Este script cumple dos objetivos fundamentales:
# 1. Obtener la data local del MVP (Gran Concepción) paginada y guardarla en GeoJSON.
# 2. Obtener estadísticas Nacionales mediante consultas ligeras a la API para
#    justificar la escalabilidad de la arquitectura en el informe (Rúbricas E2/E4).
# ==============================================================================

ENDPOINT = "https://services3.arcgis.com/vaJl1B5HEzZj7154/arcgis/rest/services/Puntos_criticos_2020_2025/FeatureServer/0/query"

# Bounding box aproximado del Gran Concepción en WGS84 (lon_min, lat_min, lon_max, lat_max)
BBOX_GRAN_CONCEPCION = "-73.20,-37.15,-72.85,-36.55"

# Tamaño aproximado por fila de datos en Postgres/PostGIS (geometría + columnas)
BYTES_PER_ROW_ESTIMATE = 300 


def obtener_datos_locales():
    """Descarga los datos del Gran Concepción paginando los resultados."""
    print("--- 1. CONSULTANDO PUNTOS CRÍTICOS (GRAN CONCEPCIÓN) ---")
    
    params = {
        "where": "1=1",
        "geometry": BBOX_GRAN_CONCEPCION,
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
        "returnGeometry": "true",
        "resultOffset": 0,
        "resultRecordCount": 2000,
        "orderByFields": "FID"
    }

    start_time = time.time()
    all_features = []
    offset = 0
    page_count = 0

    while True:
        params["resultOffset"] = offset
        page_count += 1
        print(f"Obteniendo página local {page_count} (offset {offset})...")
        
        res = requests.get(ENDPOINT, params=params, timeout=60)
        res.raise_for_status()
        data = res.json()

        if "error" in data:
            raise RuntimeError(f"La API devolvio un error: {data['error']}")
        
        features = data.get("features", [])
        if not features:
            break
            
        all_features.extend(features)
        
        # Verificar si la API nos indica que excedimos el límite de transferencia
        exceeded = data.get("properties", {}).get("exceededTransferLimit", False)
        if not exceeded and len(features) < params["resultRecordCount"]:
            break # No hay más datos
                 
        offset += len(features)

    exec_time = time.time() - start_time
    print(f"-> Total local extraído: {len(all_features)} puntos en {round(exec_time, 2)} s.\n")
    
    return all_features, exec_time, page_count


def obtener_estadisticas_nacionales():
    """Consulta la API de CONASET para obtener métricas nacionales (sin descargar los datos crudos)."""
    print("--- 2. CONSULTANDO ESTADÍSTICAS NACIONALES (PARA ARQUITECTURA) ---")
    
    # Consulta 1: Obtener el conteo total a nivel nacional
    print("Calculando volumen total a nivel nacional...")
    res_total = requests.get(ENDPOINT, params={
        "where": "1=1",
        "returnCountOnly": "true",
        "f": "json"
    }, timeout=60)
    res_total.raise_for_status()
    total_nacional = res_total.json().get("count", 0)

    # Consulta 2: Obtener la evolución agrupada por año usando SQL de ArcGIS
    print("Calculando evolución temporal a nivel nacional...")
    params_stats = {
        "where": "1=1",
        "outStatistics": json.dumps([
            {"statisticType": "count", "onStatisticField": "FID", "outStatisticFieldName": "total_count"}
        ]),
        "groupByFieldsForStatistics": "AÑO",
        "f": "json"
    }
    res_stats = requests.get(ENDPOINT, params=params_stats, timeout=60)
    res_stats.raise_for_status()
    
    # Procesar resultados y ordenarlos por año
    evolucion_nacional = {}
    features = res_stats.json().get("features", [])
    for feat in features:
        attrs = feat.get("attributes", {})
        ano = attrs.get("AÑO")
        conteo = attrs.get("total_count")
        if ano is not None:
            evolucion_nacional[ano] = conteo
            
    # Ordenar diccionario
    evolucion_nacional = dict(sorted(evolucion_nacional.items()))
    print(f"-> Total nacional: {total_nacional} puntos.\n")
    
    return total_nacional, evolucion_nacional


def procesar_y_guardar():
    # 1. Ejecutar consultas
    features_locales, tiempo_local, paginas = obtener_datos_locales()

    # 2. Guardar GeoJSON (Solo Gran Concepción)
    output_geojson = "puntos_criticos_gran_concepcion.geojson"
    final_data = {
        "type": "FeatureCollection",
        "features": features_locales
    }
    with open(output_geojson, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False)
    print(f"Archivo guardado: '{output_geojson}'")

    total_nacional, evolucion_nacional = obtener_estadisticas_nacionales()

    # 3. Calcular Evolución Local para comparar
    evolucion_local = {}
    for feat in features_locales:
        ano = feat.get("properties", {}).get("AÑO", "Desconocido")
        evolucion_local[ano] = evolucion_local.get(ano, 0) + 1
    evolucion_local = dict(sorted(evolucion_local.items(), key=lambda item: str(item[0])))

    # 4. Calcular tamaños de almacenamiento para justificar Base de Datos
    tamano_bd_local_kb = (len(features_locales) * BYTES_PER_ROW_ESTIMATE) / 1024
    tamano_bd_nacional_kb = (total_nacional * BYTES_PER_ROW_ESTIMATE) / 1024
    tamano_json_local_kb = os.path.getsize(output_geojson) / 1024
    # Estimamos el peso del JSON Nacional asumiendo una proporción directa
    proporcion = total_nacional / len(features_locales) if len(features_locales) > 0 else 1
    tamano_json_nacional_estimado_kb = tamano_json_local_kb * proporcion
    
    # 5. Calcular proyecciones de crecimiento anual (Para E1 - RNF de capacidad)
    # A nivel Nacional
    anos_totales_nac = len(evolucion_nacional)
    promedio_registros_anual_nac = total_nacional / anos_totales_nac if anos_totales_nac > 0 else 0
    crecimiento_bd_anual_mb_nac = (promedio_registros_anual_nac * BYTES_PER_ROW_ESTIMATE) / (1024 * 1024)
    proyeccion_bd_5_anos_mb_nac = (tamano_bd_nacional_kb / 1024) + (crecimiento_bd_anual_mb_nac * 5)
    
    # A nivel Local (MVP Gran Concepción)
    anos_totales_loc = len(evolucion_local)
    promedio_registros_anual_loc = len(features_locales) / anos_totales_loc if anos_totales_loc > 0 else 0
    crecimiento_bd_anual_mb_loc = (promedio_registros_anual_loc * BYTES_PER_ROW_ESTIMATE) / (1024 * 1024)
    proyeccion_bd_5_anos_mb_loc = (tamano_bd_local_kb / 1024) + (crecimiento_bd_anual_mb_loc * 5)

    # 6. Estructurar el diccionario final de métricas
    metricas = {
        "escenario_piloto_concepcion": {
            "tiempo_extraccion_segundos": round(tiempo_local, 2),
            "paginas_consultadas": paginas,
            "total_registros": len(features_locales),
            "tamano_estimado_bd_kb": round(tamano_bd_local_kb, 2),
            "tamano_archivo_json_kb": round(tamano_json_local_kb, 2),
            "evolucion_anual": evolucion_local,
            "proyecciones_crecimiento": {
                "promedio_nuevos_registros_anual": round(promedio_registros_anual_loc),
                "crecimiento_bd_anual_mb": round(crecimiento_bd_anual_mb_loc, 2),
                "tamano_proyectado_5_anos_mb": round(proyeccion_bd_5_anos_mb_loc, 2)
            }
        },
        "arquitectura_nacional": {
            "total_registros_historicos": total_nacional,
            "tamano_estimado_bd_kb": round(tamano_bd_nacional_kb, 2),
            "tamano_json_estimado_kb": round(tamano_json_nacional_estimado_kb, 2),
            "evolucion_anual": evolucion_nacional,
            "proyecciones_crecimiento": {
                "promedio_nuevos_registros_anual": round(promedio_registros_anual_nac),
                "crecimiento_bd_anual_mb": round(crecimiento_bd_anual_mb_nac, 2),
                "tamano_proyectado_5_anos_mb": round(proyeccion_bd_5_anos_mb_nac, 2)
            }
        }
    }

    # 7. Guardar métricas en JSON
    output_metricas = "metricas_rendimiento.json"
    with open(output_metricas, "w", encoding="utf-8") as f:
        json.dump(metricas, f, ensure_ascii=False, indent=2)
    print(f"Métricas guardadas: '{output_metricas}'\n")

    # 8. Imprimir Resumen Final para copiar a LaTeX
    print("=========================================================")
    print("📊 MÉTRICAS PARA INFORME LATEX (E1 / E2 / E4)")
    print("=========================================================")
    print("▶ ESCENARIO PILOTO (Gran Concepción - MVP):")
    print(f"  - Registros descargados: {metricas['escenario_piloto_concepcion']['total_registros']}")
    print(f"  - Tamaño real en BD PostGIS: ~{round(tamano_bd_local_kb/1024, 2)} MB")
    print(f"  - Ingreso promedio de nuevos registros: ~{round(promedio_registros_anual_loc)} por año")
    print(f"  - Tasa de crecimiento de la Base de Datos: ~{round(crecimiento_bd_anual_mb_loc, 2)} MB / año")
    print(f"  - Tamaño estimado de la BD en 5 años: ~{round(proyeccion_bd_5_anos_mb_loc, 2)} MB")
    
    print("\n▶ ESCALA NACIONAL (Justificación de Arquitectura):")
    print(f"  - Total registros a gestionar: {metricas['arquitectura_nacional']['total_registros_historicos']}")
    print(f"  - Tamaño proyectado en BD PostGIS: ~{round(tamano_bd_nacional_kb/1024, 2)} MB")
    print(f"  - Tamaño proyectado en GeoJSON: ~{round(tamano_json_nacional_estimado_kb/1024, 2)} MB")
    print(f"  - Ingreso promedio de nuevos registros: ~{round(promedio_registros_anual_nac)} por año")
    print(f"  - Tasa de crecimiento de la Base de Datos: ~{round(crecimiento_bd_anual_mb_nac, 2)} MB / año")
    print(f"  - Tamaño estimado de la BD en 5 años: ~{round(proyeccion_bd_5_anos_mb_nac, 2)} MB")
    print("=========================================================")


if __name__ == "__main__":
    procesar_y_guardar()
