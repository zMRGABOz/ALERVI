"""Operaciones municipales respaldadas por PostgreSQL y almacenamiento de fotografías."""

import logging
import threading
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.persistence import persistent
from app.core.security import (
    create_access_token,
    get_password_hash,
    invalidate_user_cache,
    verify_mfa_code,
    verify_password,
)
from app.models.db_models import (
    EventoAuditoria,
    FactorRiesgo,
    FichaInspeccion,
    Fotografia,
    PuntoCritico,
    Usuario,
)
from app.schemas.api_models import (
    AuditoriaListResponse,
    CargaDatosBatchRequest,
    CargaDatosResponse,
    EventoAuditoriaResponse,
    FactorRiesgoCreateRequest,
    FactorRiesgoDto,
    FactorRiesgoUpdateRequest,
    FichaInspeccionCreateRequest,
    FichaInspeccionResponse,
    FichaInspeccionUpdateRequest,
    FotografiaResponse,
    LoginRequest,
    LoginResponse,
    PonderacionesScoringDto,
    PonderacionesUpdateRequest,
    PuntoInspeccionesResumen,
    ResumenInspeccionesResponse,
    UsuarioCreateRequest,
    UsuarioListResponse,
    UsuarioResponse,
    UsuarioUpdateRequest,
)
from app.services import storage_service

logger = logging.getLogger(__name__)

_PONDERACIONES_VIGENTES = {
    "version": "v1.0-oficial-2026",
    "w_severidad": 0.35,
    "w_frecuencia": 0.25,
    "w_tendencia": 0.20,
    "w_contexto": 0.20,
    "fecha_calibracion": "2026-10-10T12:00:00Z",
    "modificado_por": "admin@alervi.test",
    "descripcion_cambio": "Calibración oficial inicial.",
    "es_vigente": True,
}


class LoginAttemptTracker:
    """Conteo de intentos consecutivos y bloqueo temporal de cuenta (RNF-S-6)."""

    def __init__(self, max_attempts: int = 5, lockout_duration_seconds: int = 900):
        self.max_attempts = max_attempts
        self.lockout_duration_seconds = lockout_duration_seconds
        self._lock = threading.Lock()
        self._records: dict = {}

    def is_locked(self, correo: str) -> bool:
        c = (correo or "").strip().lower()
        with self._lock:
            rec = self._records.get(c)
            if not rec or not rec.get("bloqueado_hasta"):
                return False
            if datetime.now(timezone.utc) < rec["bloqueado_hasta"]:
                return True
            del self._records[c]
            return False

    def register_failed_attempt(self, correo: str) -> Tuple[int, bool]:
        c = (correo or "").strip().lower()
        now = datetime.now(timezone.utc)
        with self._lock:
            rec = self._records.get(c)
            if rec and rec.get("bloqueado_hasta"):
                if now < rec["bloqueado_hasta"]:
                    return rec["intentos"], True
                rec = None
            if not rec:
                rec = {"intentos": 0, "bloqueado_hasta": None}
                self._records[c] = rec
            rec["intentos"] += 1
            rec["ultimo_fallo"] = now
            locked = rec["intentos"] >= self.max_attempts
            if locked:
                rec["bloqueado_hasta"] = now + timedelta(
                    seconds=self.lockout_duration_seconds
                )
            return rec["intentos"], locked

    def reset_attempts(self, correo: str) -> None:
        with self._lock:
            self._records.pop((correo or "").strip().lower(), None)

    def reset_all(self) -> None:
        with self._lock:
            self._records.clear()


_login_tracker = LoginAttemptTracker(
    settings.auth_max_failed_attempts, settings.auth_lockout_duration_seconds
)


def reset_login_attempts(correo: Optional[str] = None) -> None:
    if correo:
        _login_tracker.reset_attempts(correo)
    else:
        _login_tracker.reset_all()


def _add_event(
    db: Session,
    accion: str,
    uid: Optional[int],
    entidad: Optional[str],
    entity_id: Optional[int],
):
    event = EventoAuditoria(
        id_usuario=uid,
        accion=accion,
        entidad_afectada=entidad,
        id_afectado=entity_id,
        fecha_hora=datetime.now(timezone.utc),
    )
    db.add(event)
    return event


@persistent
def registrar_evento_auditoria(
    db: Session,
    accion: str,
    id_usuario: Optional[int] = None,
    correo_usuario: Optional[str] = None,
    entidad_afectada: Optional[str] = None,
    id_afectado: Optional[int] = None,
    detalles: Optional[str] = None,
) -> EventoAuditoria:
    """No confirma un evento si la base no lo ha guardado."""
    event = _add_event(db, accion, id_usuario, entidad_afectada, id_afectado)
    db.commit()
    db.refresh(event)
    return event


def _usuario_response(user: Usuario) -> UsuarioResponse:
    return UsuarioResponse(
        id_usuario=user.id_usuario,
        correo=user.correo,
        rol=user.rol,
        activo=user.activo,
        fecha_creacion=None,
    )


@persistent
def authenticate_user(db: Session, payload: LoginRequest) -> LoginResponse:
    correo = payload.correo.strip().lower()
    user = db.query(Usuario).filter(Usuario.correo == correo).first()
    uid = user.id_usuario if user else None

    def audit(accion: str):
        registrar_evento_auditoria(
            db, accion, uid, correo, "usuario" if user else None, uid
        )

    if _login_tracker.is_locked(correo):
        audit("login_fallido")
        raise HTTPException(
            settings.auth_lockout_status_code,
            "Cuenta bloqueada temporalmente tras 5 intentos fallidos consecutivos. Intente más tarde.",
            headers={"Retry-After": str(settings.auth_lockout_duration_seconds)},
        )

    def auth_failed(detail: str):
        _login_tracker.register_failed_attempt(correo)
        audit("login_fallido")
        raise HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})

    if (
        not user
        or not user.activo
        or not verify_password(payload.password, user.hash_clave)
    ):
        auth_failed("Credenciales incorrectas: correo o contraseña inválida")

    if user.rol == "administrador":
        if not payload.codigo_mfa:
            audit("login_fallido")
            raise HTTPException(
                401,
                "Segundo factor de autenticación (MFA) requerido para el rol administrador",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_mfa_code(payload.codigo_mfa):
            auth_failed("Código MFA inválido o expirado")

    _login_tracker.reset_attempts(correo)
    audit("login_ok")
    return LoginResponse(
        access_token=create_access_token(
            {
                "sub": str(user.id_usuario),
                "id_usuario": user.id_usuario,
                "correo": user.correo,
                "rol": user.rol,
            }
        ),
        token_type="bearer",
        expires_in=28800,
        mfa_requerido=False,
        usuario=_usuario_response(user),
    )


@persistent
def listar_usuarios(
    db: Session,
    rol: Optional[str] = None,
    activo: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
) -> UsuarioListResponse:
    query = db.query(Usuario)
    if rol:
        query = query.filter(Usuario.rol == rol)
    if activo is not None:
        query = query.filter(Usuario.activo == activo)
    return UsuarioListResponse(
        total=query.count(),
        usuarios=[
            _usuario_response(u)
            for u in query.order_by(Usuario.id_usuario)
            .offset(offset)
            .limit(limit)
            .all()
        ],
    )


@persistent
def crear_usuario(db: Session, payload: UsuarioCreateRequest) -> UsuarioResponse:
    if not payload.clave:
        raise HTTPException(422, "Se requiere una contraseña para la nueva cuenta.")
    user = Usuario(
        correo=payload.correo.strip().lower(),
        hash_clave=get_password_hash(payload.clave),
        rol=payload.rol,
        activo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    invalidate_user_cache(user.id_usuario)
    return _usuario_response(user)


@persistent
def obtener_usuario_por_id(db: Session, id_usuario: int) -> Optional[UsuarioResponse]:
    user = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    return _usuario_response(user) if user else None


@persistent
def actualizar_usuario(
    db: Session, id_usuario: int, payload: UsuarioUpdateRequest
) -> Optional[UsuarioResponse]:
    user = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not user:
        return None
    if payload.rol is not None:
        user.rol = payload.rol
    if payload.activo is not None:
        user.activo = payload.activo
    db.commit()
    invalidate_user_cache(id_usuario)
    db.refresh(user)
    return _usuario_response(user)


def _factor_response(factor: FactorRiesgo) -> FactorRiesgoDto:
    return FactorRiesgoDto(
        id_factor=factor.id_factor,
        nombre=factor.nombre,
        descripcion=factor.descripcion,
        activo=factor.activo,
    )


@persistent
def listar_factores_riesgo(
    db: Session, solo_activos: bool = True
) -> List[FactorRiesgoDto]:
    query = db.query(FactorRiesgo)
    if solo_activos:
        query = query.filter(FactorRiesgo.activo.is_(True))
    return [_factor_response(f) for f in query.order_by(FactorRiesgo.id_factor).all()]


@persistent
def crear_factor_riesgo(
    db: Session, payload: FactorRiesgoCreateRequest
) -> FactorRiesgoDto:
    factor = FactorRiesgo(
        nombre=payload.nombre.strip(), descripcion=payload.descripcion, activo=True
    )
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return _factor_response(factor)


@persistent
def actualizar_factor_riesgo(
    db: Session, id_factor: int, payload: FactorRiesgoUpdateRequest
) -> Optional[FactorRiesgoDto]:
    factor = db.query(FactorRiesgo).filter(FactorRiesgo.id_factor == id_factor).first()
    if not factor:
        return None
    if payload.nombre is not None:
        factor.nombre = payload.nombre.strip()
    if payload.descripcion is not None:
        factor.descripcion = payload.descripcion
    if payload.activo is not None:
        factor.activo = payload.activo
    db.commit()
    db.refresh(factor)
    return _factor_response(factor)


def obtener_ponderaciones() -> PonderacionesScoringDto:
    suma = sum(
        _PONDERACIONES_VIGENTES[k]
        for k in ("w_severidad", "w_frecuencia", "w_tendencia", "w_contexto")
    )
    return PonderacionesScoringDto(**_PONDERACIONES_VIGENTES, suma_pesos=round(suma, 4))


def calibrar_ponderaciones(
    payload: PonderacionesUpdateRequest,
) -> PonderacionesScoringDto:
    suma = (
        payload.w_severidad
        + payload.w_frecuencia
        + payload.w_tendencia
        + payload.w_contexto
    )
    if round(suma, 4) != 1.0:
        raise HTTPException(
            422, "La suma de ponderaciones debe ser exactamente 1.0 (RB-5)."
        )
    _PONDERACIONES_VIGENTES.update(
        w_severidad=payload.w_severidad,
        w_frecuencia=payload.w_frecuencia,
        w_tendencia=payload.w_tendencia,
        w_contexto=payload.w_contexto,
        version="v1.1-calibrada-2026",
        fecha_calibracion=datetime.now(timezone.utc).isoformat(),
        descripcion_cambio=payload.descripcion_cambio or "Calibración actualizada.",
    )
    return obtener_ponderaciones()


def _require_author(ficha: FichaInspeccion, current_user: Optional[dict]) -> int:
    if not current_user:
        raise HTTPException(401, "Autenticación requerida.")
    uid = current_user.get("id_usuario")
    if current_user.get("rol") != "inspector" or uid != ficha.id_usuario:
        raise HTTPException(
            403,
            "Solo el inspector autor de la ficha puede modificarla o adjuntar fotos (RB-11).",
        )
    return uid


def _factores_validos(db: Session, ids: Optional[List[int]]) -> List[FactorRiesgo]:
    ids = ids or []
    if len(set(ids)) != len(ids) or any(i <= 0 for i in ids):
        raise HTTPException(
            422, "Los identificadores de factores deben ser positivos y no repetidos."
        )
    factores = (
        db.query(FactorRiesgo)
        .filter(FactorRiesgo.id_factor.in_(ids), FactorRiesgo.activo.is_(True))
        .all()
        if ids
        else []
    )
    if len(factores) != len(ids):
        raise HTTPException(422, "Uno o más factores no existen o están inactivos.")
    return factores


def _validate_ficha_content(notas: Optional[str], factores) -> None:
    if not (notas or "").strip() and not factores:
        raise HTTPException(
            422,
            "La ficha requiere al menos un factor de riesgo o una nota descriptiva.",
        )


def _foto_response(foto: Fotografia) -> FotografiaResponse:
    return FotografiaResponse(
        id_foto=foto.id_foto,
        id_ficha=foto.id_ficha,
        ruta=foto.ruta,
        url=storage_service.photo_url(foto.ruta),
        tamano_bytes=None,
        fecha_subida=None,
    )


def _ficha_response(ficha: FichaInspeccion) -> FichaInspeccionResponse:
    return FichaInspeccionResponse(
        id_ficha=ficha.id_ficha,
        id_punto=ficha.id_punto,
        nombre_interseccion=f"Intersección #{ficha.id_punto} (Concepción)",
        id_inspector=ficha.id_usuario,
        correo_inspector=ficha.usuario.correo,
        fecha_visita=ficha.fecha_visita.isoformat(),
        fecha_registro=None,
        notas=ficha.notas,
        factores_riesgo=[
            _factor_response(f)
            for f in sorted(ficha.factores_riesgo, key=lambda f: f.id_factor)
        ],
        fotografias=[
            _foto_response(f)
            for f in sorted(ficha.fotografias, key=lambda f: f.id_foto)
        ],
    )


@persistent
def crear_ficha_inspeccion(
    db: Session,
    payload: FichaInspeccionCreateRequest,
    current_user: Optional[dict] = None,
) -> FichaInspeccionResponse:
    if not current_user:
        raise HTTPException(401, "Autenticación requerida.")
    if current_user.get("rol") != "inspector":
        raise HTTPException(
            403, "El registro de fichas está reservado al rol Inspector."
        )
    if (
        not db.query(PuntoCritico)
        .filter(PuntoCritico.id_punto == payload.id_punto)
        .first()
    ):
        raise HTTPException(404, "Punto crítico no encontrado.")
    factores = _factores_validos(db, payload.factores_riesgo_ids)
    _validate_ficha_content(payload.notas, factores)
    ficha = FichaInspeccion(
        id_punto=payload.id_punto,
        id_usuario=current_user["id_usuario"],
        fecha_visita=date.fromisoformat(payload.fecha_visita),
        notas=payload.notas,
    )
    ficha.factores_riesgo = factores
    db.add(ficha)
    db.flush()
    _add_event(db, "ficha_crear", ficha.id_usuario, "ficha_inspeccion", ficha.id_ficha)
    db.commit()
    db.refresh(ficha)
    return _ficha_response(ficha)


@persistent
def obtener_ficha_por_id(
    db: Session, id_ficha: int
) -> Optional[FichaInspeccionResponse]:
    ficha = (
        db.query(FichaInspeccion).filter(FichaInspeccion.id_ficha == id_ficha).first()
    )
    return _ficha_response(ficha) if ficha else None


@persistent
def actualizar_ficha_inspeccion(
    db: Session,
    id_ficha: int,
    payload: FichaInspeccionUpdateRequest,
    current_user: Optional[dict] = None,
) -> Optional[FichaInspeccionResponse]:
    ficha = (
        db.query(FichaInspeccion)
        .filter(FichaInspeccion.id_ficha == id_ficha)
        .with_for_update()
        .first()
    )
    if not ficha:
        return None
    uid = _require_author(ficha, current_user)
    if payload.notas is not None:
        ficha.notas = payload.notas
    if payload.fecha_visita is not None:
        ficha.fecha_visita = date.fromisoformat(payload.fecha_visita)
    if payload.factores_riesgo_ids is not None:
        ficha.factores_riesgo = _factores_validos(db, payload.factores_riesgo_ids)
    _validate_ficha_content(ficha.notas, ficha.factores_riesgo)
    _add_event(db, "ficha_editar", uid, "ficha_inspeccion", ficha.id_ficha)
    db.commit()
    db.refresh(ficha)
    return _ficha_response(ficha)


@persistent
def agregar_fotografia_ficha(
    db: Session,
    id_ficha: int,
    file_bytes: Optional[bytes] = None,
    filename: str = "",
    content_type: str = "",
    current_user: Optional[dict] = None,
) -> FotografiaResponse:
    """Serializa subidas por ficha y confirma archivo, metadatos y auditoría reales."""
    ficha = (
        db.query(FichaInspeccion)
        .filter(FichaInspeccion.id_ficha == id_ficha)
        .with_for_update()
        .first()
    )
    if not ficha:
        raise HTTPException(404, "Ficha de inspección no encontrada.")
    uid = _require_author(ficha, current_user)
    if file_bytes is None:
        raise HTTPException(400, "Se requiere un archivo de imagen.")
    try:
        sanitized_bytes, ext, mime = storage_service.sanitize_image_exif(
            file_bytes, filename
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if db.query(Fotografia).filter(Fotografia.id_ficha == id_ficha).count() >= 3:
        raise HTTPException(400, "La ficha admite un máximo de 3 fotografías.")
    try:
        path, url, size = storage_service.upload_photo(sanitized_bytes, ext, mime)
    except (IOError, RuntimeError) as exc:
        logger.exception("No fue posible almacenar la fotografía")
        raise HTTPException(
            502, "No fue posible almacenar la fotografía en el proveedor configurado."
        ) from exc
    try:
        foto = Fotografia(id_ficha=id_ficha, ruta=path)
        db.add(foto)
        db.flush()
        _add_event(db, "foto_subir", uid, "fotografia", foto.id_foto)
        response = FotografiaResponse(
            id_foto=foto.id_foto,
            id_ficha=id_ficha,
            ruta=path,
            url=url,
            tamano_bytes=size,
            fecha_subida=datetime.now(timezone.utc).isoformat(),
        )
        db.commit()
        return response
    except Exception:
        db.rollback()
        try:
            storage_service.delete_photo(path)
        except Exception:
            logger.exception(
                "No fue posible retirar el archivo tras fallar su registro"
            )
        raise


@persistent
def obtener_resumen_inspecciones(db: Session) -> ResumenInspeccionesResponse:
    """Cuenta fichas persistidas una sola vez, sin multiplicarlas por factores o fotos."""
    rows = (
        db.query(
            FichaInspeccion.id_punto,
            func.count(FichaInspeccion.id_ficha).label("total_fichas"),
        )
        .group_by(FichaInspeccion.id_punto)
        .order_by(desc("total_fichas"), FichaInspeccion.id_punto)
        .all()
    )
    puntos = [
        PuntoInspeccionesResumen(
            id_punto=row.id_punto, total_fichas_inspeccion=row.total_fichas
        )
        for row in rows
    ]
    return ResumenInspeccionesResponse(
        total_fichas_inspeccion=sum(p.total_fichas_inspeccion for p in puntos),
        puntos=puntos,
    )


@persistent
def listar_fichas_de_punto(db: Session, id_punto: int) -> List[FichaInspeccionResponse]:
    if not db.query(PuntoCritico).filter(PuntoCritico.id_punto == id_punto).first():
        raise HTTPException(404, "Punto crítico no encontrado.")
    fichas = (
        db.query(FichaInspeccion)
        .filter(FichaInspeccion.id_punto == id_punto)
        .order_by(desc(FichaInspeccion.fecha_visita), desc(FichaInspeccion.id_ficha))
        .all()
    )
    return [_ficha_response(f) for f in fichas]


@persistent
def listar_eventos_auditoria(
    db: Session,
    accion: Optional[str] = None,
    id_usuario: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditoriaListResponse:
    query = db.query(EventoAuditoria)
    if accion:
        query = query.filter(EventoAuditoria.accion == accion)
    if id_usuario is not None:
        query = query.filter(EventoAuditoria.id_usuario == id_usuario)
    return AuditoriaListResponse(
        total=query.count(),
        eventos=[
            EventoAuditoriaResponse(
                id_evento=e.id_evento,
                id_usuario=e.id_usuario,
                correo_usuario=e.usuario.correo if e.usuario else "sistema@alervi.test",
                accion=e.accion,
                entidad_afectada=e.entidad_afectada,
                id_afectado=str(e.id_afectado) if e.id_afectado is not None else None,
                fecha_hora=e.fecha_hora.isoformat(),
                detalles=f"Acción {e.accion} registrada en {e.entidad_afectada or 'sistema'}.",
            )
            for e in query.order_by(desc(EventoAuditoria.fecha_hora))
            .offset(offset)
            .limit(limit)
            .all()
        ],
    )


def procesar_carga_vial(
    db: Session, payload: CargaDatosBatchRequest
) -> CargaDatosResponse:
    # La importación efectiva se realiza con packages/db/ingest, no con resultados prefijados.
    raise HTTPException(
        501,
        "La carga HTTP no está implementada. Utilice los cargadores de packages/db/ingest.",
    )
