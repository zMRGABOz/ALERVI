"""
Servicio de operaciones geoespaciales y analíticas PostGIS para ALERVI.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Provee funciones para:
- Capa pública de puntos críticos en formato GeoJSON FeatureCollection.
- Ranking jerarquizado según fórmula multicriterio (RF-3).
- Detalle técnico y contexto de entorno urbano (150m buffer).
- Evaluación en tiempo real de telemetría para alertas de proximidad (RF-8).
"""

import logging
import math
import threading
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException

from app.core.persistence import persistent
from app.models.db_models import (
    Comuna,
    ElementoUrbano,
    FichaInspeccion,
    PuntoCritico,
    Registro,
)
from app.schemas.api_models import (
    AlertCheckRequest,
    AlertCheckResponse,
    AlertDetail,
    DesgloseFactoresScoring,
    ElementoUrbanoCercano,
    EntornoUrbanoContexto,
    GeoJsonFeature,
    GeoJsonFeatureCollection,
    GeoJsonPoint,
    HistoricoSiniestrosAnual,
    PuntoCriticoProperties,
    PuntoCriticoTecnicoDetail,
    PuntoRankingItem,
    PuntoSinIndiceItem,
    RankingResponse,
)

try:
    from geoalchemy2 import Geography
    from geoalchemy2.functions import (
        ST_X,
        ST_Y,
        ST_Contains,
        ST_Distance,
        ST_DWithin,
        ST_Intersects,
        ST_MakeEnvelope,
        ST_MakePoint,
        ST_SetSRID,
    )
    from sqlalchemy import cast, desc, func
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session
except ImportError:
    Geography = None  # type: ignore
    Session = object  # type: ignore

    class OperationalError(Exception):  # type: ignore
        pass


logger = logging.getLogger("alervi.spatial_service")


def _normalizar_comuna_filtro(comuna: Optional[str]) -> str:
    """Remueve tildes para búsqueda flexible contra la base de datos."""
    if not comuna:
        return "Concepc"
    c = comuna.strip().lower()
    c = (
        c.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )
    if "concepc" in c:
        return "Concepc"
    return comuna.strip()


def _calcular_scoring(
    total_siniestros: int,
    fallecidos: int,
    graves: int,
    menos_graves: int = 0,
    leves: int = 0,
    colegios_count: int = 0,
    paraderos_count: int = 0,
) -> Tuple[float, str, float, float, float, float]:
    """
    Calcula severidad (S), frecuencia (F), tendencia (T), contexto (C)
    y el Índice de Prioridad (IP) según fórmula multicriterio:
    IP = 0.35*S + 0.25*F + 0.20*T + 0.20*C
    """
    raw_s = fallecidos * 25.0 + graves * 8.0 + menos_graves * 3.0 + leves * 1.0
    severidad_s = round(min(100.0, raw_s), 1)

    frecuencia_f = round(min(100.0, total_siniestros * 1.5), 1)
    tendencia_t = 65.0 if fallecidos > 0 else 45.0
    contexto_c = round(
        min(100.0, colegios_count * 20.0 + paraderos_count * 10.0 + 30.0), 1
    )

    w_s, w_f, w_t, w_c = 0.35, 0.25, 0.20, 0.20
    ip = round(
        w_s * severidad_s + w_f * frecuencia_f + w_t * tendencia_t + w_c * contexto_c, 1
    )

    if ip >= 70.0:
        nivel = "CRITICO"
    elif ip >= 45.0:
        nivel = "ALTO"
    elif ip >= 20.0:
        nivel = "MEDIO"
    else:
        nivel = "BAJO"

    return ip, nivel, severidad_s, frecuencia_f, tendencia_t, contexto_c


_ENTORNO_CACHE: Optional[Dict[int, Tuple[int, int]]] = None
_ALERTS_PUNTOS_CACHE: Optional[Tuple[Tuple[int, float, float, int, int], ...]] = None
_RANKING_BASE_CACHE: Dict[
    Tuple[str, int, int],
    Tuple[Tuple[int, float, float, str, int, int, int, int, int], ...],
] = {}
_CAPA_BASE_CACHE: Dict[
    Tuple[str, Optional[int]],
    Tuple[Tuple[int, float, float, str, int, int, int, int, int], ...],
] = {}
_ENTORNO_CACHE_LOCK = threading.Lock()
_SALIDA_QUERY_LOCK = threading.Lock()
_BUFFER_ENTORNO_METROS = 150.0
# Prefiltro en grados WGS84 (~265 m E-O x ~333 m N-S en Concepción) que habilita
# el índice GiST sobre `geometry(Point, 4326)` antes del cálculo exacto Geography.
_BUFFER_ENTORNO_GRADOS_BBOX = 0.003


def limpiar_cache_entorno() -> None:
    """Invalida los cachés en memoria de datos geoespaciales estáticos."""
    global _ENTORNO_CACHE, _ALERTS_PUNTOS_CACHE
    with _ENTORNO_CACHE_LOCK:
        _ENTORNO_CACHE = None
    with _SALIDA_QUERY_LOCK:
        _ALERTS_PUNTOS_CACHE = None
        _RANKING_BASE_CACHE.clear()
        _CAPA_BASE_CACHE.clear()


def _consultar_conteos_entorno(
    db: Session, ids: Optional[List[int]] = None
) -> Dict[int, Tuple[int, int]]:
    query = db.query(
        PuntoCritico.id_punto,
        func.count(ElementoUrbano.id_elemento)
        .filter(ElementoUrbano.categoria == "colegio")
        .label("colegios"),
        func.count(ElementoUrbano.id_elemento)
        .filter(ElementoUrbano.categoria == "paradero")
        .label("paraderos"),
    ).join(
        ElementoUrbano,
        ST_DWithin(
            ElementoUrbano.geometry,
            PuntoCritico.geometry,
            _BUFFER_ENTORNO_GRADOS_BBOX,
        )
        & ST_DWithin(
            cast(ElementoUrbano.geometry, Geography),
            cast(PuntoCritico.geometry, Geography),
            _BUFFER_ENTORNO_METROS,
        ),
    )
    if ids is not None:
        query = query.filter(PuntoCritico.id_punto.in_(ids))
    rows = query.group_by(PuntoCritico.id_punto).all()
    return {r.id_punto: (int(r.colegios), int(r.paraderos)) for r in rows}


def _conteos_entorno(
    db: Session, ids: Optional[List[int]] = None
) -> Dict[int, Tuple[int, int]]:
    """Un solo agregado espacial cacheado en memoria para compartir entre capa y ranking.

    Como `punto_critico` y `elemento_urbano` son catálogos estáticos de solo lectura
    para la API, el mapa completo `{id_punto: (colegios, paraderos)}` se calcula una
    sola vez y se reutiliza en memoria sin repetir el JOIN espacial por petición.
    """
    global _ENTORNO_CACHE

    if Session is object or not isinstance(db, Session):
        if ids is not None and not ids:
            return {}
        return _consultar_conteos_entorno(db, ids)

    if _ENTORNO_CACHE is not None:
        return _ENTORNO_CACHE

    with _ENTORNO_CACHE_LOCK:
        if _ENTORNO_CACHE is None:
            _ENTORNO_CACHE = _consultar_conteos_entorno(db)
        return _ENTORNO_CACHE


@persistent
def obtener_capa_riesgo_publico(
    db: Session,
    comuna: Optional[str] = None,
    bbox: Optional[str] = None,
    limit: Optional[int] = None,
) -> GeoJsonFeatureCollection:
    """Retorna la capa GeoJSON pública con coordenadas WGS84 y estadísticas agregadas."""
    try:
        filtro_comuna = _normalizar_comuna_filtro(comuna)

        query = (
            db.query(
                PuntoCritico.id_punto,
                ST_X(PuntoCritico.geometry).label("lon"),
                ST_Y(PuntoCritico.geometry).label("lat"),
                Comuna.nombre.label("comuna_nombre"),
                func.coalesce(func.sum(Registro.cantidad_siniestros), 0).label(
                    "total_siniestros"
                ),
                func.coalesce(func.sum(Registro.fallecidos), 0).label(
                    "total_fallecidos"
                ),
                func.coalesce(func.sum(Registro.graves), 0).label("total_graves"),
                func.coalesce(func.sum(Registro.menos_graves), 0).label(
                    "total_menos_graves"
                ),
                func.coalesce(func.sum(Registro.leves), 0).label("total_leves"),
            )
            .join(Comuna, ST_Contains(Comuna.geometry, PuntoCritico.geometry))
            .outerjoin(Registro, Registro.id_punto == PuntoCritico.id_punto)
            .filter(Comuna.nombre.ilike(f"%{filtro_comuna}%"))
            .group_by(PuntoCritico.id_punto, PuntoCritico.geometry, Comuna.nombre)
        )

        if bbox:
            try:
                min_x, min_y, max_x, max_y = [float(c.strip()) for c in bbox.split(",")]
                if not all(
                    math.isfinite(v) for v in (min_x, min_y, max_x, max_y)
                ) or not (
                    -180 <= min_x <= max_x <= 180 and -90 <= min_y <= max_y <= 90
                ):
                    raise ValueError("Límites fuera de rango")
                envelope = ST_SetSRID(ST_MakeEnvelope(min_x, min_y, max_x, max_y), 4326)
                query = query.filter(ST_Intersects(PuntoCritico.geometry, envelope))
            except ValueError as exc:
                raise HTTPException(
                    400, "El bbox debe contener minLon,minLat,maxLon,maxLat válidos."
                ) from exc

        # El contrato devuelve la capa comunal, no un Top N parcial del ranking.
        use_cache = Session is not object and isinstance(db, Session) and not bbox
        capa_key = (filtro_comuna.lower(), limit)

        if use_cache and capa_key in _CAPA_BASE_CACHE:
            base_rows = _CAPA_BASE_CACHE[capa_key]
        else:

            def _fetch_capa_rows():
                q = query.order_by(
                    desc("total_siniestros"), PuntoCritico.id_punto
                ).limit(limit)
                raw = q.all()
                parsed = []
                for r in raw:
                    c_disp = (
                        "Concepción"
                        if "concepc" in (r.comuna_nombre or "").lower()
                        else r.comuna_nombre
                    )
                    parsed.append(
                        (
                            r.id_punto,
                            round(float(r.lon), 6),
                            round(float(r.lat), 6),
                            c_disp,
                            int(r.total_siniestros),
                            int(r.total_fallecidos),
                            int(r.total_graves),
                            int(r.total_menos_graves),
                            int(r.total_leves),
                        )
                    )
                return tuple(parsed)

            if use_cache:
                with _SALIDA_QUERY_LOCK:
                    if capa_key not in _CAPA_BASE_CACHE:
                        _CAPA_BASE_CACHE[capa_key] = _fetch_capa_rows()
                    base_rows = _CAPA_BASE_CACHE[capa_key]
            else:
                base_rows = _fetch_capa_rows()

        if not base_rows:
            return GeoJsonFeatureCollection(type="FeatureCollection", features=[])

        entorno = _conteos_entorno(db, [r[0] for r in base_rows])
        features: List[GeoJsonFeature] = []
        for (
            id_punto,
            lon_r,
            lat_r,
            nombre_comuna_disp,
            tot_sin,
            tot_fall,
            tot_grav,
            tot_mgrav,
            tot_lev,
        ) in base_rows:
            colegios, paraderos = entorno.get(id_punto, (0, 0))
            ip, nivel, _, _, _, _ = _calcular_scoring(
                total_siniestros=tot_sin,
                fallecidos=tot_fall,
                graves=tot_grav,
                menos_graves=tot_mgrav,
                leves=tot_lev,
                colegios_count=colegios,
                paraderos_count=paraderos,
            )

            nombre_punto = f"Punto Crítico #{id_punto} ({nombre_comuna_disp})"

            features.append(
                GeoJsonFeature(
                    type="Feature",
                    id=id_punto,
                    geometry=GeoJsonPoint(
                        type="Point",
                        coordinates=[lon_r, lat_r],
                    ),
                    properties=PuntoCriticoProperties(
                        id_punto=id_punto,
                        nombre_interseccion=nombre_punto,
                        comuna=nombre_comuna_disp,
                        nivel_riesgo=nivel,
                        indice_prioridad=ip,
                        total_siniestros=tot_sin,
                        total_fallecidos=tot_fall,
                        total_graves=tot_grav,
                        tendencia="ALZA" if tot_fall > 0 else "ESTABLE",
                        resumen_publico=f"Sector con {tot_sin} siniestros registrados y prioridad relativa {nivel}.",
                    ),
                )
            )

        return GeoJsonFeatureCollection(type="FeatureCollection", features=features)
    except Exception:
        raise


@persistent
def obtener_ranking(
    db: Session,
    comuna: Optional[str] = "Concepción",
    anio: Optional[int] = None,
    periodo_inicio: Optional[int] = 2020,
    periodo_fin: Optional[int] = 2025,
    limit: int = 10,
    offset: int = 0,
) -> RankingResponse:
    """Genera el ranking jerarquizado de puntos críticos según el índice de prioridad (RF-3, RB-5, RB-7)."""
    comuna_nombre_resp = comuna or "Concepción"
    if anio is not None:
        p_ini = anio
        p_fin = anio
        periodo_resp = str(anio)
    else:
        p_ini = periodo_inicio or 2020
        p_fin = periodo_fin or 2025
        periodo_resp = str(p_ini) if p_ini == p_fin else f"{p_ini}-{p_fin}"

    try:
        filtro_comuna = _normalizar_comuna_filtro(comuna)

        query = (
            db.query(
                PuntoCritico.id_punto,
                ST_X(PuntoCritico.geometry).label("lon"),
                ST_Y(PuntoCritico.geometry).label("lat"),
                Comuna.nombre.label("comuna_nombre"),
                func.coalesce(func.sum(Registro.cantidad_siniestros), 0).label(
                    "total_siniestros"
                ),
                func.coalesce(func.sum(Registro.fallecidos), 0).label(
                    "total_fallecidos"
                ),
                func.coalesce(func.sum(Registro.graves), 0).label("total_graves"),
                func.coalesce(func.sum(Registro.menos_graves), 0).label(
                    "total_menos_graves"
                ),
                func.coalesce(func.sum(Registro.leves), 0).label("total_leves"),
            )
            .join(Comuna, ST_Contains(Comuna.geometry, PuntoCritico.geometry))
            .outerjoin(
                Registro,
                (Registro.id_punto == PuntoCritico.id_punto)
                & (Registro.anio >= p_ini)
                & (Registro.anio <= p_fin),
            )
            .filter(Comuna.nombre.ilike(f"%{filtro_comuna}%"))
            .group_by(PuntoCritico.id_punto, PuntoCritico.geometry, Comuna.nombre)
        )

        use_cache = Session is not object and isinstance(db, Session)
        rank_key = (filtro_comuna.lower(), p_ini, p_fin)

        if use_cache and rank_key in _RANKING_BASE_CACHE:
            base_rows = _RANKING_BASE_CACHE[rank_key]
        else:

            def _fetch_ranking_rows():
                raw = query.all()
                parsed = []
                for r in raw:
                    c_disp = (
                        "Concepción"
                        if "concepc" in (r.comuna_nombre or "").lower()
                        else (r.comuna_nombre or comuna_nombre_resp)
                    )
                    parsed.append(
                        (
                            r.id_punto,
                            round(float(r.lat), 6) if r.lat is not None else 0.0,
                            round(float(r.lon), 6) if r.lon is not None else 0.0,
                            c_disp,
                            int(r.total_siniestros or 0),
                            int(r.total_fallecidos or 0),
                            int(r.total_graves or 0),
                            int(r.total_menos_graves or 0),
                            int(r.total_leves or 0),
                        )
                    )
                return tuple(parsed)

            if use_cache:
                with _SALIDA_QUERY_LOCK:
                    if rank_key not in _RANKING_BASE_CACHE:
                        _RANKING_BASE_CACHE[rank_key] = _fetch_ranking_rows()
                    base_rows = _RANKING_BASE_CACHE[rank_key]
            else:
                base_rows = _fetch_ranking_rows()

        if not base_rows:
            logger.info(
                "Consulta de ranking sin registros para comuna '%s' (%s). Retornando resultado vacío legítimo.",
                comuna_nombre_resp,
                periodo_resp,
            )
            return RankingResponse(
                total_puntos=0,
                configuracion_version="v1.0-oficial-2026",
                fecha_calculo=datetime.now(timezone.utc).isoformat(),
                comuna=comuna_nombre_resp,
                periodo=periodo_resp,
                puntos=[],
                puntos_sin_indice=[],
            )

        entorno = _conteos_entorno(db, [r[0] for r in base_rows])
        candidatos = []
        sin_indice_raw = []

        for (
            id_punto,
            lat_r,
            lon_r,
            nombre_comuna_disp,
            tot_sin,
            tot_fall,
            tot_grav,
            tot_mgrav,
            tot_lev,
        ) in base_rows:
            if tot_sin > 0:
                colegios, paraderos = entorno.get(id_punto, (0, 0))
                ip, nivel, s, f, t, c = _calcular_scoring(
                    total_siniestros=tot_sin,
                    fallecidos=tot_fall,
                    graves=tot_grav,
                    menos_graves=tot_mgrav,
                    leves=tot_lev,
                    colegios_count=colegios,
                    paraderos_count=paraderos,
                )
                candidatos.append(
                    (
                        ip,
                        tot_fall,
                        tot_grav,
                        tot_sin,
                        id_punto,
                        nivel,
                        s,
                        f,
                        t,
                        c,
                        lat_r,
                        lon_r,
                        nombre_comuna_disp,
                    )
                )
            else:
                sin_indice_raw.append((id_punto, lat_r, lon_r, nombre_comuna_disp))

        # RB-7: Criterio estricto de ordenación del contrato OpenAPI:
        # 1. IP descendente
        # 2. Fallecidos descendente
        # 3. Graves descendente
        # 4. Total siniestros descendente
        # 5. id_punto ascendente
        candidatos.sort(
            key=lambda x: (
                -x[0],
                -x[1],
                -x[2],
                -x[3],
                x[4],
            )
        )

        total_puntos = len(candidatos)
        puntos_pagina = (
            candidatos[offset : offset + limit] if offset < total_puntos else []
        )

        items: List[PuntoRankingItem] = []
        for idx, item in enumerate(puntos_pagina):
            items.append(
                PuntoRankingItem(
                    id_punto=item[4],
                    posicion_ranking=offset + idx + 1,
                    nombre_interseccion=f"Intersección #{item[4]} ({item[12]})",
                    comuna=item[12],
                    latitud=item[10],
                    longitud=item[11],
                    nivel_riesgo=item[5],
                    indice_prioridad=item[0],
                    severidad_s=item[6],
                    frecuencia_f=item[7],
                    tendencia_t=item[8],
                    contexto_c=item[9],
                    total_siniestros=item[3],
                    total_fallecidos=item[1],
                    total_graves=item[2],
                    estado_indice="CALCULADO",
                )
            )

        puntos_sin_indice = (
            [
                PuntoSinIndiceItem(
                    id_punto=p_id,
                    nombre_interseccion=f"Intersección #{p_id} ({c_disp})",
                    comuna=c_disp,
                    latitud=p_lat,
                    longitud=p_lon,
                    motivo=f"Sin registros de siniestros en período {periodo_resp}",
                )
                for p_id, p_lat, p_lon, c_disp in sin_indice_raw[:limit]
            ]
            if not items
            else []
        )

        return RankingResponse(
            total_puntos=total_puntos,
            configuracion_version="v1.0-oficial-2026",
            fecha_calculo=datetime.now(timezone.utc).isoformat(),
            comuna=comuna_nombre_resp,
            periodo=periodo_resp,
            puntos=items,
            puntos_sin_indice=puntos_sin_indice,
        )
    except Exception:
        raise


@persistent
def obtener_detalle_punto(
    db: Session, id_punto: int
) -> Optional[PuntoCriticoTecnicoDetail]:
    """Obtiene el detalle analítico completo de un punto crítico con entorno urbano."""
    try:
        punto_row = (
            db.query(
                PuntoCritico.id_punto,
                PuntoCritico.geometry,
                ST_X(PuntoCritico.geometry).label("lon"),
                ST_Y(PuntoCritico.geometry).label("lat"),
                Comuna.nombre.label("comuna_nombre"),
            )
            .outerjoin(Comuna, ST_Contains(Comuna.geometry, PuntoCritico.geometry))
            .filter(PuntoCritico.id_punto == id_punto)
            .first()
        )

        if not punto_row:
            return None

        registros = (
            db.query(Registro)
            .filter(Registro.id_punto == id_punto)
            .order_by(desc(Registro.anio))
            .all()
        )

        historico_anual = [
            HistoricoSiniestrosAnual(
                anio=r.anio,
                cantidad_siniestros=r.cantidad_siniestros,
                fallecidos=r.fallecidos,
                graves=r.graves,
                menos_graves=r.menos_graves,
                leves=r.leves,
            )
            for r in registros
        ]

        total_sin = sum(r.cantidad_siniestros for r in registros)
        total_fall = sum(r.fallecidos for r in registros)
        total_grav = sum(r.graves for r in registros)
        total_mg = sum(r.menos_graves for r in registros)
        total_lev = sum(r.leves for r in registros)

        punto_geog = cast(
            ST_SetSRID(ST_MakePoint(float(punto_row.lon), float(punto_row.lat)), 4326),
            Geography,
        )
        elem_geog = cast(ElementoUrbano.geometry, Geography)

        elementos_cercanos = (
            db.query(
                ElementoUrbano.id_elemento,
                ElementoUrbano.nombre,
                ElementoUrbano.categoria,
                ST_Distance(elem_geog, punto_geog).label("dist_m"),
            )
            .filter(ST_DWithin(elem_geog, punto_geog, 150.0))
            .order_by("dist_m")
            .all()
        )

        colegios = [e for e in elementos_cercanos if e.categoria == "colegio"]
        paraderos = [e for e in elementos_cercanos if e.categoria == "paradero"]

        colegio_top = (
            ElementoUrbanoCercano(
                id_elemento=colegios[0].id_elemento,
                nombre=colegios[0].nombre or "Colegio cercano",
                categoria="colegio",
                distancia_m=int(colegios[0].dist_m),
            )
            if colegios
            else None
        )

        paradero_top = (
            ElementoUrbanoCercano(
                id_elemento=paraderos[0].id_elemento,
                nombre=paraderos[0].nombre or "Paradero cercano",
                categoria="paradero",
                distancia_m=int(paraderos[0].dist_m),
            )
            if paraderos
            else None
        )

        total_fichas = (
            db.query(func.count(FichaInspeccion.id_ficha))
            .filter(FichaInspeccion.id_punto == id_punto)
            .scalar()
            or 0
        )

        ip, nivel, s, f, t, c = _calcular_scoring(
            total_siniestros=total_sin,
            fallecidos=total_fall,
            graves=total_grav,
            menos_graves=total_mg,
            leves=total_lev,
            colegios_count=len(colegios),
            paraderos_count=len(paraderos),
        )

        nombre_comuna_disp = "Concepción"
        if punto_row.comuna_nombre and "concepc" in punto_row.comuna_nombre.lower():
            nombre_comuna_disp = "Concepción"

        ref_urbana = (
            paradero_top.nombre
            if paradero_top
            else (colegio_top.nombre if colegio_top else f"Sector #{id_punto}")
        )
        nombre_interseccion = f"Punto #{id_punto} ({ref_urbana})"

        return PuntoCriticoTecnicoDetail(
            id_punto=id_punto,
            nombre_interseccion=nombre_interseccion,
            comuna=nombre_comuna_disp,
            latitud=round(float(punto_row.lat), 6),
            longitud=round(float(punto_row.lon), 6),
            nivel_riesgo=nivel,
            indice_prioridad=ip,
            estado_indice="CALCULADO" if registros else "SIN_INDICE_DISPONIBLE",
            configuracion_pesos_version="v1.0-oficial-2026",
            desglose_scoring=DesgloseFactoresScoring(
                formula="IP = w1*S + w2*F + w3*T + w4*C",
                w_severidad=0.35,
                severidad_s=s,
                aporte_severidad=round(0.35 * s, 2),
                w_frecuencia=0.25,
                frecuencia_f=f,
                aporte_frecuencia=round(0.25 * f, 2),
                w_tendencia=0.20,
                tendencia_t=t,
                aporte_tendencia=round(0.20 * t, 2),
                w_contexto=0.20,
                contexto_c=c,
                aporte_contexto=round(0.20 * c, 2),
            ),
            historico_anual=historico_anual,
            entorno_urbano=EntornoUrbanoContexto(
                buffer_metros=150,
                total_colegios_buffer=len(colegios),
                total_paraderos_buffer=len(paraderos),
                colegio_mas_cercano=colegio_top,
                paradero_mas_cercano=paradero_top,
            ),
            total_fichas_inspeccion=total_fichas,
            explicacion_tecnica=f"Intersección evaluada con {total_sin} siniestros y {total_fall} fallecidos en serie histórica.",
            advertencia_legal="El índice expresa prioridad relativa dentro de Concepción (RB-6).",
        )
    except Exception:
        raise


def _distancia_haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia geodésica aproximada en metros sobre esfera WGS84 media."""
    r_m = 6371008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi * 0.5) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda * 0.5) ** 2
    )
    return 2.0 * r_m * math.asin(min(1.0, math.sqrt(a)))


def _obtener_puntos_alertas_cacheados(
    db: Session,
) -> Tuple[Tuple[int, float, float, int, int], ...]:
    global _ALERTS_PUNTOS_CACHE
    if _ALERTS_PUNTOS_CACHE is not None:
        return _ALERTS_PUNTOS_CACHE

    with _SALIDA_QUERY_LOCK:
        if _ALERTS_PUNTOS_CACHE is None:
            rows = (
                db.query(
                    PuntoCritico.id_punto,
                    ST_Y(PuntoCritico.geometry).label("lat"),
                    ST_X(PuntoCritico.geometry).label("lon"),
                    func.coalesce(func.sum(Registro.fallecidos), 0).label("fallecidos"),
                    func.coalesce(func.sum(Registro.cantidad_siniestros), 0).label(
                        "total_siniestros"
                    ),
                )
                .outerjoin(Registro, Registro.id_punto == PuntoCritico.id_punto)
                .group_by(PuntoCritico.id_punto, PuntoCritico.geometry)
                .all()
            )
            _ALERTS_PUNTOS_CACHE = tuple(
                (
                    int(r.id_punto),
                    float(r.lat),
                    float(r.lon),
                    int(r.fallecidos or 0),
                    int(r.total_siniestros or 0),
                )
                for r in rows
            )
        return _ALERTS_PUNTOS_CACHE


@persistent
def evaluar_alerta_proximidad(
    db: Session, payload: AlertCheckRequest
) -> AlertCheckResponse:
    """Evalúa la posición instantánea del vehículo con PostGIS para emitir alerta sonora/visual (RF-8)."""
    try:
        lat = getattr(payload, "latitude", getattr(payload, "latitud", -36.8271))
        lon = getattr(payload, "longitude", getattr(payload, "longitud", -73.0543))

        vel_mps = getattr(payload, "speed_mps", None)
        if vel_mps is not None:
            vel_kmh = vel_mps * 3.6
        else:
            vel_kmh = getattr(payload, "velocidad_kmh", 0.0) or 0.0
            vel_mps = vel_kmh * (1000.0 / 3600.0)

        if vel_kmh < 5.0:
            return AlertCheckResponse(
                alerta_activa=False,
                telemetria_status="SUPRIMIDO_VELOCIDAD_BAJA",
                alerta=None,
            )

        if Session is not object and isinstance(db, Session):
            puntos = _obtener_puntos_alertas_cacheados(db)
            candidatos = []
            for p_id, p_lat, p_lon, fall, tot_sin in puntos:
                if abs(p_lat - lat) > 0.0022 or abs(p_lon - lon) > 0.003:
                    continue
                dist_m = _distancia_haversine_m(lat, lon, p_lat, p_lon)
                if dist_m <= 200.0:
                    candidatos.append(
                        SimpleNamespace(
                            id_punto=p_id,
                            lat=p_lat,
                            lon=p_lon,
                            distancia_m=dist_m,
                            fallecidos=fall,
                            total_siniestros=tot_sin,
                        )
                    )
            candidatos.sort(key=lambda item: item.distancia_m)
        else:
            user_pt = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
            user_geog = cast(user_pt, Geography)
            punto_geog = cast(PuntoCritico.geometry, Geography)

            query_candidatos = (
                db.query(
                    PuntoCritico.id_punto,
                    ST_Distance(punto_geog, user_geog).label("distancia_m"),
                    ST_X(PuntoCritico.geometry).label("lon"),
                    ST_Y(PuntoCritico.geometry).label("lat"),
                    func.coalesce(func.sum(Registro.fallecidos), 0).label("fallecidos"),
                    func.coalesce(func.sum(Registro.cantidad_siniestros), 0).label(
                        "total_siniestros"
                    ),
                )
                .outerjoin(Registro, Registro.id_punto == PuntoCritico.id_punto)
                .filter(
                    ST_DWithin(PuntoCritico.geometry, user_pt, 0.004)
                    & ST_DWithin(punto_geog, user_geog, 200.0)
                )
                .group_by(PuntoCritico.id_punto, PuntoCritico.geometry)
                .order_by("distancia_m")
            )

            candidatos = []
            if hasattr(query_candidatos, "all"):
                res = query_candidatos.all()
                if res:
                    candidatos = res if isinstance(res, list) else [res]
            if not candidatos and hasattr(query_candidatos, "first"):
                first_row = query_candidatos.first()
                if first_row:
                    candidatos = [first_row]

        if not candidatos:
            return AlertCheckResponse(
                alerta_activa=False,
                telemetria_status="SIN_PUNTOS_EN_RANGO",
                alerta=None,
            )

        rumbo = getattr(payload, "heading_degrees", None)
        if rumbo is None:
            rumbo = getattr(payload, "rumbo_grados", None)

        if rumbo is None:
            return AlertCheckResponse(
                alerta_activa=False,
                telemetria_status="SUPRIMIDO_TRAYECTORIA_DIVERGENTE",
                alerta=None,
            )

        rumbo_rad = math.radians(rumbo)
        vx = vel_mps * math.sin(rumbo_rad)
        vy = vel_mps * math.cos(rumbo_rad)

        meters_per_deg_lat = 111132.95
        meters_per_deg_lon = 111132.95 * math.cos(math.radians(lat))

        en_direccion_acercamiento = 0
        convergentes = []

        for p in candidatos:
            p_lon = getattr(p, "lon", lon)
            p_lat = getattr(p, "lat", lat)
            rel_x = (p_lon - lon) * meters_per_deg_lon
            rel_y = (p_lat - lat) * meters_per_deg_lat

            # Producto escalar velocidad * desplazamiento relativo
            producto_escalar = vx * rel_x + vy * rel_y
            if producto_escalar <= vel_mps * 1e-3:
                continue

            en_direccion_acercamiento += 1

            dist_m = getattr(p, "distancia_m", None)
            if dist_m is None:
                dist_m = math.hypot(rel_x, rel_y)
            else:
                dist_m = float(dist_m)

            ttc_seg = dist_m / vel_mps if vel_mps > 0 else 999.0
            if ttc_seg > 12.0:
                continue

            convergentes.append((ttc_seg, getattr(p, "id_punto", 0), dist_m, p))

        if not convergentes:
            motivo = (
                "SUPRIMIDO_TTC_MAYOR_12S"
                if en_direccion_acercamiento > 0
                else "SUPRIMIDO_TRAYECTORIA_DIVERGENTE"
            )
            return AlertCheckResponse(
                alerta_activa=False,
                telemetria_status=motivo,
                alerta=None,
            )

        # RB-14: seleccionar menor TTC; ante empate, menor id_punto
        convergentes.sort(key=lambda item: (item[0], item[1]))
        elegido_ttc, elegido_id, elegido_dist, cercano = convergentes[0]

        dist_m = round(float(elegido_dist), 1)
        ttc_seg = round(float(elegido_ttc), 1)

        fallecidos = getattr(cercano, "fallecidos", 0) or 0
        total_siniestros = getattr(cercano, "total_siniestros", 0) or 0
        es_critico = fallecidos > 0 or total_siniestros >= 50
        nivel = "CRITICO" if es_critico else "ALTO"
        patron = "BEEP_URGENTE" if es_critico else "BEEP_PRECAUCION"

        return AlertCheckResponse(
            alerta_activa=True,
            telemetria_status="EVALUADO_CON_ALERTA",
            alerta=AlertDetail(
                id_punto=cercano.id_punto,
                nombre_interseccion=f"Punto Crítico #{cercano.id_punto} (Concepción)",
                nivel_riesgo=nivel,
                distancia_m=dist_m,
                ttc_segundos=ttc_seg,
                mensaje_visual=f"⚠️ Zona de Riesgo a {int(dist_m)} m: Punto #{cercano.id_punto}",
                patron_sonoro=patron,
                instruccion_seguridad="Reduzca velocidad y preste atención al cruce",
            ),
        )
    except Exception:
        raise
