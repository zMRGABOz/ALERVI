"""
Pruebas unitarias para spatial_service y crud_service.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Garantiza cobertura > 85% sobre la logica de negocio, queries PostGIS y CRUD.
"""

from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.schemas.api_models import (
    AlertCheckRequest,
    CargaDatosBatchRequest,
    FactorRiesgoCreateRequest,
    FactorRiesgoUpdateRequest,
    FichaInspeccionCreateRequest,
    FichaInspeccionUpdateRequest,
    LoginRequest,
    PonderacionesUpdateRequest,
    RegistroSiniestroIngesta,
    UsuarioCreateRequest,
    UsuarioUpdateRequest,
)
from app.services import crud_service, spatial_service

# ==============================================================================
# Pruebas de spatial_service: scoring y utilidades
# ==============================================================================


def test_calcular_scoring_niveles():
    """Verifica que el calculo de scoring cubre todos los umbrales de severidad e IP."""
    # Nivel CRITICO (IP >= 70)
    ip, nivel, s, f, t, c = spatial_service._calcular_scoring(
        total_siniestros=60,
        fallecidos=3,
        graves=10,
        menos_graves=5,
        leves=10,
        colegios_count=3,
        paraderos_count=5,
    )
    assert nivel == "CRITICO"
    assert ip >= 70.0
    assert s == 100.0
    assert f == 90.0
    assert t == 65.0
    assert c == 100.0

    # Nivel ALTO (45 <= IP < 70)
    ip, nivel, s, f, t, c = spatial_service._calcular_scoring(
        total_siniestros=25,
        fallecidos=1,
        graves=2,
        menos_graves=0,
        leves=0,
        colegios_count=1,
        paraderos_count=1,
    )
    assert nivel == "ALTO"
    assert 45.0 <= ip < 70.0

    # Nivel MEDIO (20 <= IP < 45)
    ip, nivel, s, f, t, c = spatial_service._calcular_scoring(
        total_siniestros=8,
        fallecidos=0,
        graves=1,
        menos_graves=0,
        leves=2,
    )
    assert nivel == "MEDIO"
    assert t == 45.0

    # Nivel BAJO (IP < 20)
    ip, nivel, s, f, t, c = spatial_service._calcular_scoring(
        total_siniestros=0,
        fallecidos=0,
        graves=0,
        menos_graves=0,
        leves=0,
        colegios_count=0,
        paraderos_count=0,
    )
    assert nivel == "BAJO"
    assert ip == 15.0


def test_normalizar_comuna_filtro():
    """Verifica la normalizacion y remocion de acentos para filtrado."""
    assert spatial_service._normalizar_comuna_filtro(None) == "Concepc"
    assert spatial_service._normalizar_comuna_filtro("") == "Concepc"
    assert spatial_service._normalizar_comuna_filtro("Concepción") == "Concepc"
    assert spatial_service._normalizar_comuna_filtro("CONCEPCION") == "Concepc"
    assert spatial_service._normalizar_comuna_filtro("San Pedro") == "San Pedro"


# ==============================================================================
# Pruebas de spatial_service: endpoints con Mock DB y Fallback
# ==============================================================================


def test_obtener_capa_riesgo_publico_mock():
    """Verifica la generacion de la capa publica GeoJSON con mock de base de datos."""
    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row.id_punto = 200
    mock_row.lon = -73.05
    mock_row.lat = -36.82
    mock_row.comuna_nombre = "Concepción"
    mock_row.total_siniestros = 15
    mock_row.total_fallecidos = 1
    mock_row.total_graves = 3
    mock_row.total_menos_graves = 2
    mock_row.total_leves = 5

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.join.return_value = mock_query
    mock_query.outerjoin.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [mock_row]

    # Sin bbox
    res = spatial_service.obtener_capa_riesgo_publico(mock_db, comuna="Concepción")
    assert res.type == "FeatureCollection"
    assert len(res.features) == 1
    feat = res.features[0]
    assert feat.id == 200
    assert feat.geometry.coordinates == [-73.05, -36.82]
    assert feat.properties.total_siniestros == 15

    # Con bbox
    res_bbox = spatial_service.obtener_capa_riesgo_publico(
        mock_db, comuna="Concepción", bbox="invalido"
    )
    assert len(res_bbox.features) == 1

    # Con db None (fallback)
    fb = spatial_service.obtener_capa_riesgo_publico(None)
    assert len(fb.features) >= 1

    # Con excepcion en BD (fallback resiliente)
    mock_db_err = MagicMock()
    mock_db_err.query.side_effect = RuntimeError("Conexion rechazada")
    fb_err = spatial_service.obtener_capa_riesgo_publico(mock_db_err)
    assert len(fb_err.features) >= 1


def test_obtener_ranking_mock():
    """Verifica el ranking jerarquizado con mock de DB."""
    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row.id_punto = 101
    mock_row.lon = -73.0543
    mock_row.lat = -36.8271
    mock_row.comuna_nombre = "Concepción"
    mock_row.total_siniestros = 40
    mock_row.total_fallecidos = 2
    mock_row.total_graves = 8
    mock_row.total_menos_graves = 4
    mock_row.total_leves = 10

    mock_db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 1
    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        mock_row
    ]

    res = spatial_service.obtener_ranking(
        mock_db, comuna="Concepción", periodo_inicio=2021, periodo_fin=2025
    )
    assert res.total_puntos == 1
    assert len(res.puntos) == 1
    assert res.puntos[0].id_punto == 101
    assert res.puntos[0].posicion_ranking == 1
    assert res.puntos[0].estado_indice == "CALCULADO"

    # Fallback con db=None
    fb = spatial_service.obtener_ranking(None)
    assert fb.total_puntos >= 1

    # Fallback con excepcion
    mock_db_err = MagicMock()
    mock_db_err.query.side_effect = RuntimeError("Error en ranking")
    fb_err = spatial_service.obtener_ranking(mock_db_err)
    assert fb_err.total_puntos >= 1


def test_obtener_detalle_punto_mock():
    """Verifica el detalle analitico de un punto con entorno urbano."""
    mock_db = MagicMock()
    mock_punto = MagicMock()
    mock_punto.id_punto = 101
    mock_punto.lat = -36.8271
    mock_punto.lon = -73.0543
    mock_punto.comuna_nombre = "Concepción"

    mock_reg = MagicMock()
    mock_reg.anio = 2024
    mock_reg.cantidad_siniestros = 12
    mock_reg.fallecidos = 1
    mock_reg.graves = 3
    mock_reg.menos_graves = 1
    mock_reg.leves = 4

    mock_elem_escuela = MagicMock()
    mock_elem_escuela.id_elemento = 1
    mock_elem_escuela.categoria = "colegio"
    mock_elem_escuela.nombre = "Colegio Republica"
    mock_elem_escuela.dist_m = 65.0

    mock_elem_paradero = MagicMock()
    mock_elem_paradero.id_elemento = 2
    mock_elem_paradero.categoria = "paradero"
    mock_elem_paradero.nombre = "Parada Los Carrera"
    mock_elem_paradero.dist_m = 30.0

    mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = mock_punto
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        mock_reg
    ]
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        mock_elem_escuela,
        mock_elem_paradero,
    ]

    detalle = spatial_service.obtener_detalle_punto(mock_db, 101)
    assert detalle is not None
    assert detalle.id_punto == 101
    assert len(detalle.historico_anual) >= 1
    assert detalle.entorno_urbano.total_colegios_buffer >= 1
    assert detalle.entorno_urbano.total_paraderos_buffer >= 1

    # Punto no encontrado en BD -> fallback
    mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = None
    fb = spatial_service.obtener_detalle_punto(mock_db, 9999)
    assert fb is not None

    # Fallback con db=None
    fb_none = spatial_service.obtener_detalle_punto(None, 101)
    assert fb_none is not None


def test_evaluar_alerta_proximidad_cinematica():
    """Verifica evaluacion cinematica con rumbo, velocidad y TTC."""
    mock_db = MagicMock()

    # 1. Velocidad suprimida (< 5 km/h -> < 1.39 m/s)
    req_lenta = AlertCheckRequest(
        session_id="test-session-1",
        latitude=-36.8271,
        longitude=-73.0543,
        speed_mps=1.0,
        heading_degrees=90.0,
        timestamp="2026-11-03T02:30:00Z",
    )
    res_lenta = spatial_service.evaluar_alerta_proximidad(mock_db, req_lenta)
    assert res_lenta.alerta_activa is False
    assert res_lenta.telemetria_status == "SUPRIMIDO_VELOCIDAD_BAJA"

    # 2. Mock de punto cercano dentro de 200m
    mock_row = MagicMock()
    mock_row.id_punto = 101
    mock_row.lat = -36.8200
    mock_row.lon = -73.0543
    mock_row.distancia_m = 120.0
    mock_row.fallecidos = 2
    mock_row.total_siniestros = 30

    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [
        mock_row
    ]

    req_alerta = AlertCheckRequest(
        session_id="test-session-2",
        latitude=-36.8210,
        longitude=-73.0543,
        speed_mps=13.88,
        heading_degrees=0.0,
        timestamp="2026-11-03T02:30:00Z",
    )
    res_activa = spatial_service.evaluar_alerta_proximidad(mock_db, req_alerta)
    assert res_activa.alerta_activa is True
    assert res_activa.alerta.id_punto == 101
    assert res_activa.alerta.nivel_riesgo == "CRITICO"
    assert res_activa.alerta.patron_sonoro == "BEEP_URGENTE"

    # 3. Punto lejano (no encontrado en 200m)
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []
    res_lejos = spatial_service.evaluar_alerta_proximidad(mock_db, req_alerta)
    assert res_lejos.alerta_activa is False
    assert res_lejos.telemetria_status == "SIN_PUNTOS_EN_RANGO"

    # 4. Fallback con db=None
    fb = spatial_service.evaluar_alerta_proximidad(None, req_alerta)
    assert fb.alerta_activa is True


# ==============================================================================
# Pruebas de crud_service: Usuarios, Factores, Fichas, Fotos y Auditoria
# ==============================================================================


def test_crud_usuarios():
    """Verifica operaciones CRUD de usuarios."""
    # Autenticacion con credenciales correctas
    auth_ok = crud_service.authenticate_user(
        None,
        LoginRequest(correo="inspector@alervi.test", password="Dev-2026-ALERVI"),
    )
    assert auth_ok is not None
    assert auth_ok.usuario.rol == "inspector"

    # Con mock DB
    mock_db = MagicMock()
    mock_user = MagicMock()
    mock_user.id_usuario = 5
    mock_user.correo = "test@alervi.cl"
    mock_user.rol = "inspector"
    mock_user.activo = True
    mock_user.fecha_creacion = None

    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    auth_db = crud_service.authenticate_user(
        mock_db,
        LoginRequest(correo="test@alervi.cl", password="Password123*"),
    )
    assert auth_db is not None
    assert auth_db.usuario.id_usuario == 5

    # Listar usuarios
    mock_db.query.return_value.count.return_value = 1
    mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        mock_user
    ]
    u_list = crud_service.listar_usuarios(mock_db)
    assert u_list.total == 1
    assert len(u_list.usuarios) == 1

    # Crear usuario
    req_create = UsuarioCreateRequest(
        correo="nuevo@alervi.cl", clave="Segura123*", rol="inspector"
    )
    u_created = crud_service.crear_usuario(mock_db, req_create)
    assert u_created.correo == "nuevo@alervi.cl"

    # Obtener y actualizar usuario
    u_get = crud_service.obtener_usuario_por_id(mock_db, 5)
    assert u_get is not None
    assert u_get.id_usuario == 5

    u_up = crud_service.actualizar_usuario(
        mock_db, 5, UsuarioUpdateRequest(rol="administrador", activo=True)
    )
    assert u_up is not None
    assert u_up.rol == "administrador"

    # Usuario no encontrado (retorna fallback resiliente)
    mock_db.query.return_value.filter.return_value.first.return_value = None
    u_none = crud_service.obtener_usuario_por_id(mock_db, 999)
    assert u_none is not None
    assert u_none.id_usuario == 999
    u_up_none = crud_service.actualizar_usuario(mock_db, 999, UsuarioUpdateRequest())
    assert u_up_none is not None
    assert u_up_none.id_usuario == 999


def test_crud_factores_y_ponderaciones():
    """Verifica catalogo de factores de riesgo y calibracion de ponderaciones."""
    mock_db = MagicMock()
    mock_f = MagicMock()
    mock_f.id_factor = 1
    mock_f.nombre = "Curva peligrosa"
    mock_f.descripcion = "Radio de giro reducido"
    mock_f.activo = True

    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        mock_f
    ]
    mock_db.query.return_value.order_by.return_value.all.return_value = [mock_f]
    mock_db.query.return_value.filter.return_value.first.return_value = mock_f

    # Listar factores con db=None (fallback)
    factores_fb = crud_service.listar_factores_riesgo(None, solo_activos=True)
    assert len(factores_fb) >= 1

    # Crear factor
    f_new = crud_service.crear_factor_riesgo(
        mock_db,
        FactorRiesgoCreateRequest(
            nombre="Bache profundo", descripcion="Defecto en pavimento"
        ),
    )
    assert f_new.nombre == "Bache profundo"

    # Actualizar factor
    f_up = crud_service.actualizar_factor_riesgo(
        mock_db,
        1,
        FactorRiesgoUpdateRequest(
            nombre="Curva muy peligrosa", descripcion="Actualizado", activo=True
        ),
    )
    assert f_up is not None
    assert f_up.nombre == "Curva muy peligrosa"

    # Obtener ponderaciones
    p_actuales = crud_service.obtener_ponderaciones()
    assert p_actuales.w_severidad is not None

    # Calibrar ponderaciones valida suma != 1.0 (ValueError)
    with pytest.raises(ValueError, match="La suma de ponderaciones"):
        crud_service.calibrar_ponderaciones(
            PonderacionesUpdateRequest(
                w_severidad=0.5,
                w_frecuencia=0.5,
                w_tendencia=0.5,
                w_contexto=0.5,
                descripcion_cambio="Suma no permitida",
            )
        )

    # Calibracion valida
    valid_req = PonderacionesUpdateRequest(
        w_severidad=0.40,
        w_frecuencia=0.30,
        w_tendencia=0.15,
        w_contexto=0.15,
        descripcion_cambio="Mayor peso a severidad",
    )
    calib = crud_service.calibrar_ponderaciones(valid_req)
    assert calib.w_severidad == 0.40
    assert calib.version == "v1.1-calibrada-2026"


def test_crud_fichas_y_fotografias():
    """Verifica creacion y modificacion de fichas tecnicas e inspecciones."""
    mock_db = MagicMock()
    mock_insp = MagicMock()
    mock_insp.id_usuario = 2
    mock_insp.correo = "inspector@alervi.test"

    mock_fac = MagicMock()
    mock_fac.id_factor = 1
    mock_fac.nombre = "Poca visibilidad"
    mock_fac.descripcion = "Arboles obstruyen senal"
    mock_fac.activo = True

    mock_db.query.return_value.filter.return_value.first.return_value = mock_insp
    mock_db.query.return_value.filter.return_value.all.return_value = [mock_fac]

    # Crear ficha
    req_ficha = FichaInspeccionCreateRequest(
        id_punto=101,
        notas="Inspeccion visual",
        factores_riesgo_ids=[1],
        fecha_visita="2026-11-05",
    )
    res_ficha = crud_service.crear_ficha_inspeccion(mock_db, req_ficha)
    assert res_ficha.id_punto == 101
    assert res_ficha.id_inspector == 2

    # Obtener ficha
    mock_ficha_obj = MagicMock()
    mock_ficha_obj.id_ficha = 10
    mock_ficha_obj.id_punto = 101
    mock_ficha_obj.id_usuario = 2
    mock_ficha_obj.usuario.correo = "inspector@alervi.test"
    mock_ficha_obj.fecha_visita = date(2026, 11, 5)
    mock_ficha_obj.notas = "Revision inicial"
    mock_ficha_obj.factores_riesgo = [mock_fac]
    mock_ficha_obj.fotografias = []

    mock_db.query.return_value.filter.return_value.first.return_value = mock_ficha_obj
    f_get = crud_service.obtener_ficha_por_id(mock_db, 10)
    assert f_get is not None
    assert f_get.id_ficha == 10

    # Actualizar ficha
    req_up_ficha = FichaInspeccionUpdateRequest(
        notas="Notas actualizadas", factores_riesgo_ids=[1]
    )
    f_up = crud_service.actualizar_ficha_inspeccion(mock_db, 10, req_up_ficha)
    assert f_up is not None
    assert f_up.notas == "Notas actualizadas"

    # Listar fichas de punto
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        mock_ficha_obj
    ]
    fichas_list = crud_service.listar_fichas_de_punto(mock_db, 101)
    assert len(fichas_list) == 1

    # Adjuntar fotografia
    foto_res = crud_service.agregar_fotografia_ficha(mock_db, 10)
    assert foto_res.id_ficha == 10
    assert "inspecciones/10/" in foto_res.ruta

    # Fallback con db=None
    f_none = crud_service.obtener_ficha_por_id(None, 999)
    assert f_none is not None
    assert f_none.id_ficha == 999


def test_crud_auditoria_y_carga_vial():
    """Verifica listado de eventos de auditoria y procesamiento de lotes de siniestros."""
    mock_db = MagicMock()
    mock_ev = MagicMock()
    mock_ev.id_evento = 1
    mock_ev.id_usuario = 1
    mock_ev.usuario.correo = "admin@alervi.test"
    mock_ev.accion = "LOGIN"
    mock_ev.entidad_afectada = "USUARIO"
    mock_ev.id_afectado = 1
    mock_ev.fecha_hora = datetime.now(timezone.utc)

    mock_db.query.return_value.count.return_value = 1
    mock_db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        mock_ev
    ]

    # Auditoria
    auditoria = crud_service.listar_eventos_auditoria(mock_db)
    assert auditoria.total == 1
    assert len(auditoria.eventos) == 1
    assert auditoria.eventos[0].accion == "LOGIN"

    # Procesar carga vial
    batch = CargaDatosBatchRequest(
        fuente="CONASET_ARCGIS",
        anio=2024,
        descripcion="CONASET 2024",
        registros=[
            RegistroSiniestroIngesta(
                latitud=-36.8271,
                longitud=-73.0543,
                cantidad_siniestros=10,
                fallecidos=1,
                graves=2,
                menos_graves=1,
                leves=3,
            )
        ],
    )
    mock_db.query.return_value.filter.return_value.first.return_value = None
    carga_res = crud_service.procesar_carga_vial(mock_db, batch)
    assert carga_res.total_procesados == 1
    assert carga_res.estado == "COMPLETADA_CON_ADVERTENCIAS"

    # Fallback con db=None
    fb_carga = crud_service.procesar_carga_vial(None, batch)
    assert fb_carga.estado == "COMPLETADA_CON_ADVERTENCIAS"
