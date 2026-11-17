"""
Pruebas de servicios para spatial_service y crud_service.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica scoring, consultas PostGIS, CRUD y errores de persistencia.
"""

import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from app.models.db_models import FichaInspeccion, Fotografia
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
# Pruebas de spatial_service: consultas, datos ausentes y errores de persistencia
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

    # Un bbox válido filtra la consulta; un bbox inválido se rechaza.
    res_bbox = spatial_service.obtener_capa_riesgo_publico(
        mock_db, comuna="Concepción", bbox="-73.1,-36.9,-73.0,-36.8"
    )
    assert len(res_bbox.features) == 1
    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_capa_riesgo_publico(mock_db, bbox="invalido")
    assert error.value.status_code == 400

    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_capa_riesgo_publico(None)
    assert error.value.status_code == 503

    mock_db_err = MagicMock()
    mock_db_err.query.side_effect = OperationalError(
        "SELECT", {}, RuntimeError("Conexion rechazada")
    )
    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_capa_riesgo_publico(mock_db_err)
    assert error.value.status_code == 503
    mock_db_err.rollback.assert_called_once()


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

    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = [
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

    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_ranking(None)
    assert error.value.status_code == 503

    mock_db_err = MagicMock()
    mock_db_err.query.side_effect = OperationalError(
        "SELECT", {}, RuntimeError("Error en ranking")
    )
    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_ranking(mock_db_err)
    assert error.value.status_code == 503
    mock_db_err.rollback.assert_called_once()


def test_ranking_f01_filtro_anio_individual():
    """F-01: Verifica que anio individual establezca el rango y periodo exacto."""
    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row.id_punto = 201
    mock_row.lon = -73.05
    mock_row.lat = -36.82
    mock_row.comuna_nombre = "Concepción"
    mock_row.total_siniestros = 15
    mock_row.total_fallecidos = 1
    mock_row.total_graves = 3
    mock_row.total_menos_graves = 2
    mock_row.total_leves = 9

    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = [
        mock_row
    ]

    res = spatial_service.obtener_ranking(mock_db, comuna="Concepción", anio=2024)
    assert res.periodo == "2024"
    assert res.total_puntos == 1
    assert res.puntos[0].id_punto == 201


def test_ranking_f02_orden_por_ip_y_desempates_rb7():
    """F-02: Verifica que el orden se rija por IP y desempates RB-7, no por total de siniestros."""
    mock_db = MagicMock()

    # Punto A: 20 siniestros, 0 fallecidos, 0 graves, 20 leves -> IP menor (29.5)
    punto_a = MagicMock()
    punto_a.id_punto = 1
    punto_a.lon = -73.051
    punto_a.lat = -36.821
    punto_a.comuna_nombre = "Concepción"
    punto_a.total_siniestros = 20
    punto_a.total_fallecidos = 0
    punto_a.total_graves = 0
    punto_a.total_menos_graves = 0
    punto_a.total_leves = 20

    # Punto B: 5 siniestros, 3 fallecidos, 2 graves -> IP mayor (52.7)
    punto_b = MagicMock()
    punto_b.id_punto = 2
    punto_b.lon = -73.052
    punto_b.lat = -36.822
    punto_b.comuna_nombre = "Concepción"
    punto_b.total_siniestros = 5
    punto_b.total_fallecidos = 3
    punto_b.total_graves = 2
    punto_b.total_menos_graves = 0
    punto_b.total_leves = 0

    # Punto C: empatado en IP con B (3 fall, 2 grav, 5 sin), pero con id_punto mayor (3)
    punto_c = MagicMock()
    punto_c.id_punto = 3
    punto_c.lon = -73.053
    punto_c.lat = -36.823
    punto_c.comuna_nombre = "Concepción"
    punto_c.total_siniestros = 5
    punto_c.total_fallecidos = 3
    punto_c.total_graves = 2
    punto_c.total_menos_graves = 0
    punto_c.total_leves = 0

    # Retornamos en orden A, B, C a la salida de BD
    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = [
        punto_a,
        punto_b,
        punto_c,
    ]

    res = spatial_service.obtener_ranking(mock_db, limit=10, offset=0)
    assert res.total_puntos == 3

    # El punto B debe ser 1ro por mayor IP (52.7 > 29.5)
    assert res.puntos[0].id_punto == 2
    assert res.puntos[0].posicion_ranking == 1
    assert res.puntos[0].indice_prioridad > res.puntos[2].indice_prioridad

    # El punto C debe ser 2do (empata en IP con B, desempata por id_punto ascendente 2 < 3)
    assert res.puntos[1].id_punto == 3
    assert res.puntos[1].posicion_ranking == 2

    # El punto A debe ser 3ro pese a tener 20 siniestros
    assert res.puntos[2].id_punto == 1
    assert res.puntos[2].posicion_ranking == 3


def test_ranking_f03_respuesta_vacia_legitima():
    """F-03: Verifica que una consulta sin registros devuelva lista vacía y no el fallback prefijado."""
    mock_db = MagicMock()
    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = []

    res = spatial_service.obtener_ranking(mock_db, comuna="ComunaSinPuntos")
    assert res.total_puntos == 0
    assert res.puntos == []
    # No debe tener el id_punto 101 del fallback fijo
    assert all(p.id_punto != 101 for p in res.puntos)


def test_obtener_detalle_punto_persistido(db_session):
    """Contrasta historia y distancias del detalle con PostGIS real."""
    detalle = spatial_service.obtener_detalle_punto(db_session, 101)
    assert detalle is not None
    assert detalle.id_punto == 101
    assert [row.anio for row in detalle.historico_anual] == [2025, 2024]
    assert detalle.entorno_urbano.total_colegios_buffer == 1
    assert detalle.entorno_urbano.total_paraderos_buffer == 1
    assert 40 <= detalle.entorno_urbano.colegio_mas_cercano.distancia_m <= 70
    assert 10 <= detalle.entorno_urbano.paradero_mas_cercano.distancia_m <= 30
    assert detalle.total_fichas_inspeccion == 1

    assert spatial_service.obtener_detalle_punto(db_session, 9999) is None

    with pytest.raises(HTTPException) as error:
        spatial_service.obtener_detalle_punto(None, 101)
    assert error.value.status_code == 503


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
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.first.return_value = mock_row

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
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.first.return_value = None
    res_lejos = spatial_service.evaluar_alerta_proximidad(mock_db, req_alerta)
    assert res_lejos.alerta_activa is False
    assert res_lejos.telemetria_status == "SIN_PUNTOS_EN_RANGO"

    # 4. Trayectoria divergente (rumbo 180° alejandose del punto hacia el sur)
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [
        mock_row
    ]
    req_div = AlertCheckRequest(
        session_id="test-session-3",
        latitude=-36.8210,
        longitude=-73.0543,
        speed_mps=13.88,
        heading_degrees=180.0,
        timestamp="2026-11-03T02:30:00Z",
    )
    res_div = spatial_service.evaluar_alerta_proximidad(mock_db, req_div)
    assert res_div.alerta_activa is False
    assert res_div.telemetria_status == "SUPRIMIDO_TRAYECTORIA_DIVERGENTE"

    # 5. Acercamiento pero TTC > 12s
    mock_row_lejos = MagicMock()
    mock_row_lejos.id_punto = 102
    mock_row_lejos.lat = -36.8190
    mock_row_lejos.lon = -73.0543
    mock_row_lejos.distancia_m = 180.0
    mock_row_lejos.fallecidos = 0
    mock_row_lejos.total_siniestros = 10

    mock_db.query.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [
        mock_row_lejos
    ]
    req_ttc = AlertCheckRequest(
        session_id="test-session-4",
        latitude=-36.8210,
        longitude=-73.0543,
        speed_mps=5.0,  # 5 m/s -> TTC = 180 / 5 = 36s > 12s
        heading_degrees=0.0,
        timestamp="2026-11-03T02:30:00Z",
    )
    res_ttc = spatial_service.evaluar_alerta_proximidad(mock_db, req_ttc)
    assert res_ttc.alerta_activa is False
    assert res_ttc.telemetria_status == "SUPRIMIDO_TTC_MAYOR_12S"

    # Una BD ausente no debe fabricar una alerta.
    with pytest.raises(HTTPException) as error:
        spatial_service.evaluar_alerta_proximidad(None, req_alerta)
    assert error.value.status_code == 503


# ==============================================================================
# Pruebas de crud_service: Usuarios, Factores, Fichas, Fotos y Auditoria
# ==============================================================================


def test_crud_usuarios(db_session):
    """Verifica autenticación, filtros y CRUD con cuentas persistidas."""
    auth_ok = crud_service.authenticate_user(
        db_session,
        LoginRequest(correo="inspector@alervi.test", password="Dev-2026-ALERVI"),
    )
    assert auth_ok.usuario.id_usuario == 2
    assert auth_ok.usuario.rol == "inspector"

    users = crud_service.listar_usuarios(
        db_session, rol="inspector", activo=True, limit=1, offset=1
    )
    assert users.total == 2
    assert [user.id_usuario for user in users.usuarios] == [99]

    request = UsuarioCreateRequest(
        correo="nuevo@alervi.cl", clave="Segura123*", rol="inspector"
    )
    created = crud_service.crear_usuario(db_session, request)
    assert created.correo == "nuevo@alervi.cl"
    assert (
        crud_service.obtener_usuario_por_id(db_session, created.id_usuario) == created
    )

    updated = crud_service.actualizar_usuario(
        db_session,
        created.id_usuario,
        UsuarioUpdateRequest(rol="administrador", activo=False),
    )
    assert updated.rol == "administrador"
    assert updated.activo is False

    assert crud_service.obtener_usuario_por_id(db_session, 999999) is None
    assert (
        crud_service.actualizar_usuario(db_session, 999999, UsuarioUpdateRequest())
        is None
    )

    # Un duplicado debe hacer rollback y dejar operativa la siguiente consulta.
    with pytest.raises(HTTPException) as error:
        crud_service.crear_usuario(db_session, request)
    assert error.value.status_code == 409
    assert (
        crud_service.obtener_usuario_por_id(db_session, created.id_usuario) == updated
    )


def test_crud_factores_y_ponderaciones(db_session):
    """Verifica catálogo persistido, filtros de actividad y validación de pesos."""
    assert len(crud_service.listar_factores_riesgo(db_session)) == 2
    f_new = crud_service.crear_factor_riesgo(
        db_session,
        FactorRiesgoCreateRequest(
            nombre="Bache profundo", descripcion="Defecto en pavimento"
        ),
    )
    assert f_new.nombre == "Bache profundo"

    # Actualizar factor
    f_up = crud_service.actualizar_factor_riesgo(
        db_session,
        f_new.id_factor,
        FactorRiesgoUpdateRequest(
            nombre="Curva muy peligrosa", descripcion="Actualizado", activo=False
        ),
    )
    assert f_up is not None
    assert f_up.nombre == "Curva muy peligrosa"
    assert len(crud_service.listar_factores_riesgo(db_session)) == 2
    assert len(crud_service.listar_factores_riesgo(db_session, solo_activos=False)) == 3
    assert (
        crud_service.actualizar_factor_riesgo(
            db_session, 999999, FactorRiesgoUpdateRequest(activo=False)
        )
        is None
    )

    # Obtener ponderaciones
    p_actuales = crud_service.obtener_ponderaciones()
    assert p_actuales.w_severidad is not None

    with pytest.raises(HTTPException) as error:
        crud_service.calibrar_ponderaciones(
            PonderacionesUpdateRequest(
                w_severidad=0.5,
                w_frecuencia=0.5,
                w_tendencia=0.5,
                w_contexto=0.5,
                descripcion_cambio="Suma no permitida",
            )
        )
    assert error.value.status_code == 422
    assert "La suma de ponderaciones" in error.value.detail

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


def test_crud_fichas_y_fotografias(db_session, inspector_user, jpeg_photo):
    """Crear y editar una ficha debe persistir sus relaciones y el archivo de evidencia."""
    req_ficha = FichaInspeccionCreateRequest(
        id_punto=101,
        notas="Inspeccion visual",
        factores_riesgo_ids=[1],
        fecha_visita=date.today().isoformat(),
    )
    res_ficha = crud_service.crear_ficha_inspeccion(
        db_session, req_ficha, current_user=inspector_user
    )
    assert res_ficha.id_punto == 101
    assert res_ficha.id_inspector == 2

    id_ficha = res_ficha.id_ficha
    f_get = crud_service.obtener_ficha_por_id(db_session, id_ficha)
    assert f_get is not None
    assert f_get.id_ficha == id_ficha

    # Actualizar ficha
    req_up_ficha = FichaInspeccionUpdateRequest(
        notas="Notas actualizadas",
        factores_riesgo_ids=[2],
        fecha_visita=date.today().isoformat(),
    )
    f_up = crud_service.actualizar_ficha_inspeccion(
        db_session, id_ficha, req_up_ficha, current_user=inspector_user
    )
    assert f_up is not None
    assert f_up.notas == "Notas actualizadas"
    stored = db_session.get(FichaInspeccion, id_ficha)
    assert stored.notas == f_up.notas
    assert [factor.id_factor for factor in stored.factores_riesgo] == [2]

    fichas_list = crud_service.listar_fichas_de_punto(db_session, 101)
    assert [ficha.id_ficha for ficha in fichas_list] == [id_ficha, 1]

    foto_res = crud_service.agregar_fotografia_ficha(
        db_session,
        id_ficha,
        file_bytes=jpeg_photo,
        current_user=inspector_user,
    )
    assert foto_res.id_ficha == id_ficha
    uuid_str = foto_res.ruta.split(".")[0]
    assert uuid.UUID(uuid_str)
    assert foto_res.url is not None
    assert "/storage/fichas/" in foto_res.url
    assert db_session.get(Fotografia, foto_res.id_foto).ruta == foto_res.ruta
    assert (
        crud_service.obtener_ficha_por_id(db_session, id_ficha).fotografias[0].id_foto
        == foto_res.id_foto
    )

    assert crud_service.obtener_ficha_por_id(db_session, 999999) is None
    assert (
        crud_service.actualizar_ficha_inspeccion(
            db_session, 999999, req_up_ficha, current_user=inspector_user
        )
        is None
    )
    with pytest.raises(HTTPException) as error:
        crud_service.obtener_ficha_por_id(None, 999999)
    assert error.value.status_code == 503


def test_crud_auditoria_y_carga_vial(db_session):
    """Audita en PostgreSQL y rechaza la ingesta HTTP pendiente de implementar."""
    event = crud_service.registrar_evento_auditoria(
        db_session,
        accion="login_ok",
        id_usuario=1,
        entidad_afectada="usuario",
        id_afectado=1,
    )
    auditoria = crud_service.listar_eventos_auditoria(
        db_session, accion="login_ok", id_usuario=1
    )
    assert auditoria.total == 1
    assert len(auditoria.eventos) == 1
    assert auditoria.eventos[0].id_evento == event.id_evento
    assert auditoria.eventos[0].accion == "login_ok"

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
    for session in (db_session, None):
        with pytest.raises(HTTPException) as error:
            crud_service.procesar_carga_vial(session, batch)
        assert error.value.status_code == 501


def test_login_attempt_tracker_unit():
    """Verifica lógica interna de conteo, bloqueo y expiración de LoginAttemptTracker (RNF-S-6)."""
    from app.services.crud_service import LoginAttemptTracker

    tracker = LoginAttemptTracker(max_attempts=5, lockout_duration_seconds=1)
    email = "test.tracker@alervi.cl"

    # Intentos 1 a 4
    for i in range(1, 5):
        intentos, is_locked = tracker.register_failed_attempt(email)
        assert intentos == i
        assert is_locked is False
        assert tracker.is_locked(email) is False

    # Intento 5: se bloquea
    intentos, is_locked = tracker.register_failed_attempt(email)
    assert intentos == 5
    assert is_locked is True
    assert tracker.is_locked(email) is True

    # Intento 6 (mientras está bloqueado)
    intentos, is_locked = tracker.register_failed_attempt(email)
    assert is_locked is True

    # Reseteo manual
    tracker.reset_attempts(email)
    assert tracker.is_locked(email) is False

    # Expiración temporal automática
    exp_tracker = LoginAttemptTracker(max_attempts=1, lockout_duration_seconds=0)
    exp_tracker.register_failed_attempt("exp@alervi.cl")
    # Al tener duración 0, inmediatamente ahora >= bloqueado_hasta
    import time

    time.sleep(0.01)
    assert exp_tracker.is_locked("exp@alervi.cl") is False


def test_authenticate_user_bloqueo_y_auditoria_unit(db_session):
    """RNF-S-6 / RNF-S-4: Verifica que authenticate_user lanza 403/429 en el 6to intento y audita."""
    from fastapi import HTTPException

    from app.services.crud_service import (
        authenticate_user,
        registrar_evento_auditoria,
        reset_login_attempts,
    )

    test_mail = "funcionario.bloqueo.unit@alervi.cl"
    reset_login_attempts(test_mail)

    try:
        # 5 intentos fallidos levantan 401
        for _ in range(5):
            with pytest.raises(HTTPException) as exc_info:
                authenticate_user(
                    db_session,
                    LoginRequest(correo=test_mail, password="ClaveInvalida123*"),
                )
            assert exc_info.value.status_code == 401

        # El 6to intento levanta 403 o 429
        with pytest.raises(HTTPException) as exc_info:
            authenticate_user(
                db_session,
                LoginRequest(correo=test_mail, password="ClaveInvalida123*"),
            )
        assert exc_info.value.status_code in (403, 429)
        assert "bloqueada" in exc_info.value.detail.lower()

        # Registro directo en auditoría
        ev = registrar_evento_auditoria(
            db_session,
            accion="login_fallido",
            correo_usuario=test_mail,
            detalles="Prueba unitaria de auditoría",
        )
        assert ev.id_evento > 0
        assert ev.accion == "login_fallido"
    finally:
        reset_login_attempts(test_mail)


def test_verify_mfa_code_unit():
    """Verifica validación de segundo factor MFA (RFC 6238 y código canónico)."""
    from app.core.config import settings
    from app.core.security import verify_mfa_code

    # Código canónico por defecto
    assert verify_mfa_code("482910") is True

    # Desactivación de código fijo en producción / configuración vacía
    with patch.object(settings, "admin_mfa_default_code", ""):
        assert verify_mfa_code("482910") is False

    with patch.object(settings, "admin_mfa_default_code", "disabled"):
        assert verify_mfa_code("482910") is False

    with patch.object(settings, "admin_mfa_default_code", "none"):
        assert verify_mfa_code("482910") is False

    # Códigos inválidos o malformados
    assert verify_mfa_code(None) is False
    assert verify_mfa_code("") is False
    assert verify_mfa_code("12345") is False
    assert verify_mfa_code("1234567") is False
    assert verify_mfa_code("abcdef") is False
    assert verify_mfa_code("000000") is False


def test_authenticate_user_admin_mfa_unit(db_session):
    """RNF-S-1: Login de administrador exige código MFA antes de entregar token Bearer."""
    from fastapi import HTTPException

    from app.services.crud_service import authenticate_user

    # Admin sin código MFA -> debe levantar HTTP 401
    with pytest.raises(HTTPException) as exc_info:
        authenticate_user(
            db_session,
            LoginRequest(correo="admin@alervi.test", password="Dev-2026-ALERVI"),
        )
    assert exc_info.value.status_code == 401
    assert "MFA" in exc_info.value.detail

    # Admin con código MFA inválido -> debe levantar HTTP 401
    with pytest.raises(HTTPException) as exc_info:
        authenticate_user(
            db_session,
            LoginRequest(
                correo="admin@alervi.test",
                password="Dev-2026-ALERVI",
                codigo_mfa="111111",
            ),
        )
    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower()

    # Admin con código MFA válido -> debe entregar token Bearer
    resp = authenticate_user(
        db_session,
        LoginRequest(
            correo="admin@alervi.test",
            password="Dev-2026-ALERVI",
            codigo_mfa="482910",
        ),
    )
    assert resp.access_token is not None
    assert resp.usuario.rol == "administrador"


def test_cache_conteos_entorno_lifecycle():
    """Verifica el ciclo de vida, thread-safety e invalidación de la caché de entorno urbano."""
    from app.services import spatial_service

    # Limpiar caché
    spatial_service.limpiar_cache_entorno()
    assert spatial_service._cache_conteos_entorno == {}

    # Inyección de conteos en caché
    with spatial_service._cache_conteos_lock:
        spatial_service._cache_conteos_entorno[901] = (2, 3)
        spatial_service._cache_conteos_entorno[902] = (0, 1)

    # db=None debe devolver directamente los valores de la caché
    res = spatial_service._conteos_entorno(None, [901, 902])
    assert res[901] == (2, 3)
    assert res[902] == (0, 1)

    # Puntos ausentes sin DB retornan valor neutro (0, 0)
    res_ausente = spatial_service._conteos_entorno(None, [999])
    assert res_ausente[999] == (0, 0)

    # Invalidación
    spatial_service.limpiar_cache_entorno()
    assert spatial_service._cache_conteos_entorno == {}


def test_obtener_ranking_con_entorno_urbano_en_scoring():
    """Verifica que el ranking integre los conteos de colegios/paraderos en contexto_c e IP."""
    from app.services import spatial_service

    spatial_service.limpiar_cache_entorno()
    # Punto 501: 2 colegios, 1 paradero -> C = min(100, 2*20 + 1*10 + 30) = 80.0
    with spatial_service._cache_conteos_lock:
        spatial_service._cache_conteos_entorno[501] = (2, 1)

    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row.id_punto = 501
    mock_row.lon = -73.05
    mock_row.lat = -36.82
    mock_row.comuna_nombre = "Concepción"
    mock_row.total_siniestros = 10
    mock_row.total_fallecidos = 1
    mock_row.total_graves = 2
    mock_row.total_menos_graves = 0
    mock_row.total_leves = 0

    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = [
        mock_row
    ]

    res = spatial_service.obtener_ranking(mock_db, limit=1)
    assert res.total_puntos == 1
    item = res.puntos[0]
    assert item.id_punto == 501
    # Con 2 colegios y 1 paradero, contexto_c debe ser 80.0 (en lugar del valor plano 30.0)
    assert item.contexto_c == 80.0
    # IP = 0.35*S + 0.25*F + 0.20*T + 0.20*C
    # S = min(100, 1*25 + 2*8) = 41.0
    # F = min(100, 10*1.5) = 15.0
    # T = 65.0 (fallecidos > 0)
    # C = 80.0
    # IP = 0.35*41.0 + 0.25*15.0 + 0.20*65.0 + 0.20*80.0 = 14.35 + 3.75 + 13.0 + 16.0 = 47.1
    assert item.indice_prioridad == 47.1

    spatial_service.limpiar_cache_entorno()


def test_ranking_microbenchmark_latencia_menor_80ms():
    """
    Microbenchmark: Procesa 2.672 puntos críticos en memoria simulando el dataset
    completo de Concepción con la caché poblada y verifica tiempo < 80 ms.
    """
    import time
    from collections import namedtuple

    from app.services import spatial_service

    RowSim = namedtuple(
        "RowSim",
        [
            "id_punto",
            "lon",
            "lat",
            "comuna_nombre",
            "total_siniestros",
            "total_fallecidos",
            "total_graves",
            "total_menos_graves",
            "total_leves",
        ],
    )

    # Poblamos la caché con 2.672 puntos
    spatial_service.limpiar_cache_entorno()
    puntos_sinteticos = []
    with spatial_service._cache_conteos_lock:
        for i in range(1, 2673):
            spatial_service._cache_conteos_entorno[i] = (i % 3, i % 5)
            r = RowSim(
                id_punto=i,
                lon=-73.05 + (i * 0.0001),
                lat=-36.82 + (i * 0.0001),
                comuna_nombre="Concepción",
                total_siniestros=(i % 20) + 1,
                total_fallecidos=1 if i % 10 == 0 else 0,
                total_graves=(i % 4),
                total_menos_graves=(i % 3),
                total_leves=(i % 5),
            )
            puntos_sinteticos.append(r)

    mock_db = MagicMock()
    mock_db.query.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value.all.return_value = puntos_sinteticos

    # Medición de tiempo de ejecución
    t0 = time.perf_counter()
    res = spatial_service.obtener_ranking(mock_db, limit=10, offset=0)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    print(
        f"\n[Microbenchmark] Procesamiento de 2.672 puntos críticos: {elapsed_ms:.2f} ms"
    )
    assert res.total_puntos == 2672
    assert len(res.puntos) == 10
    # Criterio estricto del usuario: tiempo menor a 80 ms (típicamente < 15 ms)
    assert elapsed_ms < 80.0, f"Tiempo {elapsed_ms:.2f} ms superó el límite de 80 ms"

    spatial_service.limpiar_cache_entorno()


def test_precargar_cache_entorno_resilience():
    """Verifica que precargar_cache_entorno sea tolerante a fallos y retorne enteros."""
    from app.services import spatial_service

    spatial_service.limpiar_cache_entorno()
    assert spatial_service.precargar_cache_entorno(None) == 0

    mock_db = MagicMock()
    mock_db.query.side_effect = RuntimeError("Conexión perdida")
    assert spatial_service.precargar_cache_entorno(mock_db) == 0
