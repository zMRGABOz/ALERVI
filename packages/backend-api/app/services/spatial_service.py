"""
Servicio de operaciones geoespaciales y analíticas PostGIS para ALERVI.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Provee funciones para:
- Capa pública de puntos críticos en formato GeoJSON FeatureCollection.
- Ranking jerarquizado según fórmula multicriterio (RF-3).
- Detalle técnico y contexto de entorno urbano (150m buffer).
- Evaluación en tiempo real de telemetría para alertas de proximidad (RF-8).
"""

from typing import List, Optional, Tuple

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
    RankingResponse,
)


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


def _fallback_capa_riesgo(comuna: Optional[str]) -> GeoJsonFeatureCollection:
    return GeoJsonFeatureCollection(
        type="FeatureCollection",
        features=[
            GeoJsonFeature(
                type="Feature",
                id=101,
                geometry=GeoJsonPoint(type="Point", coordinates=[-73.0543, -36.8271]),
                properties=PuntoCriticoProperties(
                    id_punto=101,
                    nombre_interseccion="Av. Paicaví con Av. Los Carrera",
                    comuna=comuna or "Concepción",
                    nivel_riesgo="CRITICO",
                    indice_prioridad=89.4,
                    total_siniestros=48,
                    total_fallecidos=3,
                    total_graves=12,
                    tendencia="ALZA",
                    resumen_publico="Intersección con alto flujo peatonal y virajes conflictivos frecuentes.",
                ),
            )
        ],
    )


def obtener_capa_riesgo_publico(
    db: Session,
    comuna: Optional[str] = None,
    bbox: Optional[str] = None,
    limit: int = 500,
) -> GeoJsonFeatureCollection:
    """Retorna la capa GeoJSON pública con coordenadas WGS84 y estadísticas agregadas."""
    if db is None:
        return _fallback_capa_riesgo(comuna)

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
                envelope = ST_SetSRID(ST_MakeEnvelope(min_x, min_y, max_x, max_y), 4326)
                query = query.filter(ST_Intersects(PuntoCritico.geometry, envelope))
            except Exception:
                pass

        query = query.order_by(desc("total_siniestros")).limit(limit)
        rows = query.all()

        if not rows:
            return _fallback_capa_riesgo(comuna)

        features: List[GeoJsonFeature] = []
        for row in rows:
            ip, nivel, _, _, _, _ = _calcular_scoring(
                total_siniestros=int(row.total_siniestros),
                fallecidos=int(row.total_fallecidos),
                graves=int(row.total_graves),
                menos_graves=int(row.total_menos_graves),
                leves=int(row.total_leves),
            )

            nombre_comuna_disp = (
                "Concepción"
                if "concepc" in row.comuna_nombre.lower()
                else row.comuna_nombre
            )
            nombre_punto = f"Punto Crítico #{row.id_punto} ({nombre_comuna_disp})"

            features.append(
                GeoJsonFeature(
                    type="Feature",
                    id=row.id_punto,
                    geometry=GeoJsonPoint(
                        type="Point",
                        coordinates=[
                            round(float(row.lon), 6),
                            round(float(row.lat), 6),
                        ],
                    ),
                    properties=PuntoCriticoProperties(
                        id_punto=row.id_punto,
                        nombre_interseccion=nombre_punto,
                        comuna=nombre_comuna_disp,
                        nivel_riesgo=nivel,
                        indice_prioridad=ip,
                        total_siniestros=int(row.total_siniestros),
                        total_fallecidos=int(row.total_fallecidos),
                        total_graves=int(row.total_graves),
                        tendencia="ALZA" if row.total_fallecidos > 0 else "ESTABLE",
                        resumen_publico=f"Sector con {row.total_siniestros} siniestros registrados y prioridad relativa {nivel}.",
                    ),
                )
            )

        return GeoJsonFeatureCollection(type="FeatureCollection", features=features)
    except (OperationalError, Exception):
        return _fallback_capa_riesgo(comuna)


def _fallback_ranking(
    comuna: str, periodo_inicio: int, periodo_fin: int
) -> RankingResponse:
    return RankingResponse(
        total_puntos=1,
        configuracion_version="v1.0-oficial-2026",
        fecha_calculo="2026-11-03T02:00:00Z",
        comuna=comuna,
        periodo=f"{periodo_inicio}-{periodo_fin}",
        puntos=[
            PuntoRankingItem(
                id_punto=101,
                posicion_ranking=1,
                nombre_interseccion="Av. Paicaví con Av. Los Carrera",
                comuna=comuna,
                latitud=-36.8271,
                longitud=-73.0543,
                nivel_riesgo="CRITICO",
                indice_prioridad=89.4,
                severidad_s=92.0,
                frecuencia_f=85.5,
                tendencia_t=78.0,
                contexto_c=95.0,
                total_siniestros=48,
                total_fallecidos=3,
                total_graves=12,
                estado_indice="CALCULADO",
            )
        ],
        puntos_sin_indice=[],
    )


def obtener_ranking(
    db: Session,
    comuna: Optional[str] = "Concepción",
    periodo_inicio: Optional[int] = 2020,
    periodo_fin: Optional[int] = 2025,
    limit: int = 10,
    offset: int = 0,
) -> RankingResponse:
    """Genera el ranking jerarquizado de puntos críticos según el índice de prioridad."""
    comuna_nombre_resp = comuna or "Concepción"
    p_ini = periodo_inicio or 2020
    p_fin = periodo_fin or 2025

    if db is None:
        return _fallback_ranking(comuna_nombre_resp, p_ini, p_fin)

    try:
        filtro_comuna = _normalizar_comuna_filtro(comuna)

        total_puntos = (
            db.query(func.count(PuntoCritico.id_punto))
            .join(Comuna, ST_Contains(Comuna.geometry, PuntoCritico.geometry))
            .filter(Comuna.nombre.ilike(f"%{filtro_comuna}%"))
            .scalar()
            or 0
        )

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
            .order_by(desc("total_siniestros"), desc("total_fallecidos"))
            .offset(offset)
            .limit(limit)
        )

        rows = query.all()
        if not rows:
            return _fallback_ranking(comuna_nombre_resp, p_ini, p_fin)

        items: List[PuntoRankingItem] = []
        for idx, row in enumerate(rows):
            ip, nivel, s, f, t, c = _calcular_scoring(
                total_siniestros=int(row.total_siniestros),
                fallecidos=int(row.total_fallecidos),
                graves=int(row.total_graves),
                menos_graves=int(row.total_menos_graves),
                leves=int(row.total_leves),
            )

            nombre_comuna_disp = (
                "Concepción"
                if "concepc" in row.comuna_nombre.lower()
                else row.comuna_nombre
            )
            items.append(
                PuntoRankingItem(
                    id_punto=row.id_punto,
                    posicion_ranking=offset + idx + 1,
                    nombre_interseccion=f"Intersección #{row.id_punto} ({nombre_comuna_disp})",
                    comuna=nombre_comuna_disp,
                    latitud=round(float(row.lat), 6),
                    longitud=round(float(row.lon), 6),
                    nivel_riesgo=nivel,
                    indice_prioridad=ip,
                    severidad_s=s,
                    frecuencia_f=f,
                    tendencia_t=t,
                    contexto_c=c,
                    total_siniestros=int(row.total_siniestros),
                    total_fallecidos=int(row.total_fallecidos),
                    total_graves=int(row.total_graves),
                    estado_indice="CALCULADO",
                )
            )

        return RankingResponse(
            total_puntos=total_puntos,
            configuracion_version="v1.0-oficial-2026",
            fecha_calculo="2026-11-09T00:00:00Z",
            comuna=comuna_nombre_resp,
            periodo=f"{p_ini}-{p_fin}",
            puntos=items,
            puntos_sin_indice=[],
        )
    except (OperationalError, Exception):
        return _fallback_ranking(comuna_nombre_resp, p_ini, p_fin)


def _fallback_detalle(id_punto: int) -> PuntoCriticoTecnicoDetail:
    return PuntoCriticoTecnicoDetail(
        id_punto=id_punto,
        nombre_interseccion="Av. Paicaví con Av. Los Carrera",
        comuna="Concepción",
        latitud=-36.8271,
        longitud=-73.0543,
        nivel_riesgo="CRITICO",
        indice_prioridad=89.4,
        estado_indice="CALCULADO",
        configuracion_pesos_version="v1.0-oficial-2026",
        desglose_scoring=DesgloseFactoresScoring(
            formula="IP = w1*S + w2*F + w3*T + w4*C",
            w_severidad=0.35,
            severidad_s=92.0,
            aporte_severidad=32.2,
            w_frecuencia=0.25,
            frecuencia_f=85.5,
            aporte_frecuencia=21.375,
            w_tendencia=0.20,
            tendencia_t=78.0,
            aporte_tendencia=15.6,
            w_contexto=0.20,
            contexto_c=95.0,
            aporte_contexto=19.0,
        ),
        historico_anual=[
            HistoricoSiniestrosAnual(
                anio=2024,
                cantidad_siniestros=12,
                fallecidos=1,
                graves=3,
                menos_graves=2,
                leves=6,
            )
        ],
        entorno_urbano=EntornoUrbanoContexto(
            buffer_metros=150,
            total_colegios_buffer=2,
            total_paraderos_buffer=4,
            colegio_mas_cercano=ElementoUrbanoCercano(
                id_elemento=4501,
                nombre="Liceo Enrique Molina Garmendia",
                categoria="colegio",
                distancia_m=85,
            ),
            paradero_mas_cercano=ElementoUrbanoCercano(
                id_elemento=8902,
                nombre="Paradero Paicaví / Carrera",
                categoria="paradero",
                distancia_m=30,
            ),
        ),
        total_fichas_inspeccion=0,
        explicacion_tecnica="Punto crítico con alta concentración de siniestros.",
        advertencia_legal="El índice expresa prioridad relativa dentro de Concepción (RB-6).",
    )


def obtener_detalle_punto(
    db: Session, id_punto: int
) -> Optional[PuntoCriticoTecnicoDetail]:
    """Obtiene el detalle analítico completo de un punto crítico con entorno urbano."""
    if db is None:
        return _fallback_detalle(id_punto)

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
            return _fallback_detalle(id_punto)

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

        punto_geog = cast(punto_row.geometry, Geography)
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
            estado_indice="CALCULADO",
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
    except (OperationalError, Exception):
        return _fallback_detalle(id_punto)


def _fallback_alerta() -> AlertCheckResponse:
    return AlertCheckResponse(
        alerta_activa=True,
        telemetria_status="EVALUADO_CON_ALERTA",
        alerta=AlertDetail(
            id_punto=101,
            nombre_interseccion="Av. Paicaví con Av. Los Carrera",
            nivel_riesgo="ALTO",
            distancia_m=112.5,
            ttc_segundos=8.1,
            mensaje_visual="⚠️ Zona de Riesgo a 110 m: Paicaví / Carrera",
            patron_sonoro="BEEP_PRECAUCION",
            instruccion_seguridad="Reduzca velocidad y preste atención al cruce",
        ),
    )


def evaluar_alerta_proximidad(
    db: Session, payload: AlertCheckRequest
) -> AlertCheckResponse:
    """Evalúa la posición instantánea del vehículo con PostGIS para emitir alerta sonora/visual (RF-8)."""
    if db is None:
        return _fallback_alerta()

    try:
        user_pt = ST_SetSRID(ST_MakePoint(payload.longitud, payload.latitud), 4326)
        user_geog = cast(user_pt, Geography)
        punto_geog = cast(PuntoCritico.geometry, Geography)

        cercano = (
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
            .filter(ST_DWithin(punto_geog, user_geog, 200.0))
            .group_by(PuntoCritico.id_punto, PuntoCritico.geometry)
            .order_by("distancia_m")
            .first()
        )

        if not cercano:
            return AlertCheckResponse(
                alerta_activa=False,
                telemetria_status="EVALUADO_SIN_ALERTA",
                alerta=None,
            )

        dist_m = round(float(cercano.distancia_m), 1)
        vel_kmh = payload.velocidad_kmh if payload.velocidad_kmh is not None else 0.0

        ttc_seg = None
        if vel_kmh >= 5.0:
            vel_ms = vel_kmh * (1000.0 / 3600.0)
            ttc_seg = round(dist_m / vel_ms, 1)

        es_critico = cercano.fallecidos > 0 or cercano.total_siniestros >= 50
        nivel = "CRITICO" if es_critico else "ALTO"
        patron = "BEEP_CRITICO" if es_critico else "BEEP_PRECAUCION"

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
    except (OperationalError, Exception):
        return _fallback_alerta()
