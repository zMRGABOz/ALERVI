"""
ALERVI Backend API -- Entry Point
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Alerta y Evaluacion de Riesgo Vial en Concepcion.
Implementacion integral de los endpoints del contrato OpenAPI 3.1
(packages/shared-contracts/openapi.yaml) y alineado a la base de datos
PostgreSQL/PostGIS (packages/db/migrations/).

Levantar en desarrollo:
    uvicorn app.main:app --reload --port 8000

Documentacion interactiva:
    http://localhost:8000/docs    (Swagger UI)
    http://localhost:8000/redoc   (ReDoc)
"""

from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Path, Query, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = object  # type: ignore

from app.core.config import settings
from app.core.database import get_db
from app.schemas.api_models import (
    AlertCheckRequest,
    AlertCheckResponse,
    AuditoriaListResponse,
    CargaDatosBatchRequest,
    CargaDatosResponse,
    FactorRiesgoCreateRequest,
    FactorRiesgoDto,
    FactorRiesgoUpdateRequest,
    FichaInspeccionCreateRequest,
    FichaInspeccionResponse,
    FichaInspeccionUpdateRequest,
    FotografiaResponse,
    GeoJsonFeatureCollection,
    LoginRequest,
    LoginResponse,
    PonderacionesScoringDto,
    PonderacionesUpdateRequest,
    PuntoCriticoTecnicoDetail,
    RankingResponse,
    UsuarioCreateRequest,
    UsuarioListResponse,
    UsuarioResponse,
    UsuarioUpdateRequest,
)
from app.services import crud_service, spatial_service

app = FastAPI(
    title="ALERVI System API (Web DSS & Mobile Citizen)",
    summary="Contrato unificado de servicios REST para la plataforma Web Municipal (DSS) y la App Movil Ciudadana.",
    description="Backend REST API para Alerta y Evaluacion de Riesgo Vial en Concepcion (ALERVI).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# -- CORS ----------------------------------------------------------------------
cors_origins = [origin.strip() for origin in settings.cors_origins]
if "http://localhost:3000" not in cors_origins:
    cors_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# OPERACIONES Y SALUD
# ==============================================================================
@app.get("/health", tags=["Operaciones y Salud"])
async def health_check():
    """Health check y warm-up del backend (RNF-D-1)."""
    return {
        "status": "ok",
        "service": "alervi-api",
        "version": "1.0.0",
    }


@app.get("/", tags=["Operaciones y Salud"])
async def root():
    """Redirige a la documentacion interactiva."""
    return {
        "message": "ALERVI API esta corriendo",
        "docs": "/docs",
    }


# ==============================================================================
# 1. AUTENTICACIÓN Y SESIÓN (RF-9, RNF-S-1, RNF-S-6, tabla `usuario`)
# ==============================================================================
@app.post(
    "/api/v1/auth/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    tags=["Autenticación y Sesión"],
    summary="Inicio de sesión de funcionarios municipales",
)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Inicia sesión y genera token de autenticación (RF-9)."""
    return crud_service.authenticate_user(db, payload)


# ==============================================================================
# 2. GESTIÓN DE USUARIOS (RF-9, RB-15, tabla `usuario`)
# ==============================================================================
@app.get(
    "/api/v1/usuarios",
    response_model=UsuarioListResponse,
    status_code=status.HTTP_200_OK,
    tags=["Gestión de Usuarios"],
    summary="Listar cuentas de usuarios municipales",
)
async def list_usuarios(
    rol: Optional[str] = Query(
        None, description="Filtrar por rol (inspector | administrador)"
    ),
    activo: Optional[bool] = Query(
        None, description="Filtrar por estado activo/inactivo"
    ),
    limit: Optional[int] = Query(20, description="Límite de registros"),
    offset: Optional[int] = Query(0, description="Desplazamiento"),
    db: Session = Depends(get_db),
):
    """Administra cuentas de usuario y asignación de roles. Exclusivo Administrador (RF-9)."""
    return crud_service.listar_usuarios(
        db, rol=rol, activo=activo, limit=limit or 20, offset=offset or 0
    )


@app.post(
    "/api/v1/usuarios",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Gestión de Usuarios"],
    summary="Crear una nueva cuenta de usuario municipal",
)
async def create_usuario(payload: UsuarioCreateRequest, db: Session = Depends(get_db)):
    """Registra una nueva cuenta de funcionario con rol Inspector o Administrador (RF-9)."""
    return crud_service.crear_usuario(db, payload)


@app.get(
    "/api/v1/usuarios/{id_usuario}",
    response_model=UsuarioResponse,
    status_code=status.HTTP_200_OK,
    tags=["Gestión de Usuarios"],
    summary="Consultar detalle de un usuario municipal",
)
async def get_usuario_by_id(id_usuario: int = Path(...), db: Session = Depends(get_db)):
    """Consulta técnica de una cuenta de usuario municipal por ID."""
    u = crud_service.obtener_usuario_por_id(db, id_usuario)
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )
    return u


@app.patch(
    "/api/v1/usuarios/{id_usuario}",
    response_model=UsuarioResponse,
    status_code=status.HTTP_200_OK,
    tags=["Gestión de Usuarios"],
    summary="Modificar cuenta o estado de usuario",
)
async def update_usuario(
    id_usuario: int = Path(...),
    payload: UsuarioUpdateRequest = ...,
    db: Session = Depends(get_db),
):
    """Actualiza rol, clave o estado activo de un funcionario (RF-9)."""
    u = crud_service.actualizar_usuario(db, id_usuario, payload)
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )
    return u


# ==============================================================================
# 3. INGESTA Y CARGAS VIALES (RF-1, RB-1 a RB-4)
# ==============================================================================
@app.post(
    "/api/v1/cargas",
    response_model=CargaDatosResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Ingesta y Cargas"],
    summary="Ingesta batch de siniestros viales (CONASET)",
)
async def cargar_datos_viales(
    payload: CargaDatosBatchRequest,
    db: Session = Depends(get_db),
):
    """Carga antecedentes viales, registra fuentes y valida registros territoriales (RF-1)."""
    return crud_service.procesar_carga_vial(db, payload)


# ==============================================================================
# 4. MAPA PÚBLICO (RF-2, RB-6, RNF-U-1, tablas `punto_critico`, `comuna`, `registro`)
# ==============================================================================
@app.get(
    "/api/v1/publico/riesgo",
    response_model=GeoJsonFeatureCollection,
    status_code=status.HTTP_200_OK,
    tags=["Mapa Público"],
    summary="Capa pública de puntos críticos (GeoJSON)",
)
async def get_puntos_criticos_publicos(
    comuna: Optional[str] = Query(
        None, description="Filtrar puntos por nombre de comuna (ej. 'Concepción')"
    ),
    bbox: Optional[str] = Query(
        None, description="Bounding box en formato 'minLon,minLat,maxLon,maxLat'"
    ),
    db: Session = Depends(get_db),
):
    """Capa pública de puntos críticos (ubicación, nivel y antecedentes públicos en GeoJSON) (RF-2)."""
    return spatial_service.obtener_capa_riesgo_publico(db, comuna=comuna, bbox=bbox)


# ==============================================================================
# 5. RANKING Y ANALÍTICA DSS (RF-3, RB-5, RB-7, tablas `punto_critico`, `registro`)
# ==============================================================================
@app.get(
    "/api/v1/ranking",
    response_model=RankingResponse,
    status_code=status.HTTP_200_OK,
    tags=["Ranking y Analítica"],
    summary="Consultar ranking jerarquizado de puntos críticos",
)
async def get_ranking(
    comuna: Optional[str] = Query("Concepción", description="Comuna de análisis"),
    anio: Optional[int] = Query(
        None, description="Filtrar cálculo para un año específico (2020-2025)"
    ),
    periodo_inicio: Optional[int] = Query(
        2020, description="Año de inicio del rango temporal analizado"
    ),
    periodo_fin: Optional[int] = Query(
        2025, description="Año de término del rango temporal analizado"
    ),
    limit: Optional[int] = Query(10, description="Cantidad de puntos a retornar"),
    offset: Optional[int] = Query(0, description="Desplazamiento para paginación"),
    db: Session = Depends(get_db),
):
    """Ranking ordenado de puntos con su índice; filtros por comuna y período (RF-3)."""
    return spatial_service.obtener_ranking(
        db,
        comuna=comuna,
        periodo_inicio=periodo_inicio or 2020,
        periodo_fin=periodo_fin or 2025,
        limit=limit or 10,
        offset=offset or 0,
    )


# ==============================================================================
# 6. PUNTOS CRÍTICOS - DETALLE DSS (RF-3, RB-5, tablas `punto_critico`, `registro`)
# ==============================================================================
@app.get(
    "/api/v1/puntos/{id_punto}",
    response_model=PuntoCriticoTecnicoDetail,
    status_code=status.HTTP_200_OK,
    tags=["Puntos Críticos"],
    summary="Detalle técnico y explicación del índice de un punto crítico",
)
async def get_detalle_punto_tecnico(
    id_punto: int = Path(
        ..., description="Identificador único del punto crítico", examples=[101]
    ),
    db: Session = Depends(get_db),
):
    """Detalle del punto, desglose de factores y explicación del índice (RF-3)."""
    detalle = spatial_service.obtener_detalle_punto(db, id_punto)
    if not detalle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Punto crítico no encontrado",
        )
    return detalle


# ==============================================================================
# 7. FACTORES Y PONDERACIONES (RF-4, RB-5, RB-8, tabla `factor_riesgo`)
# ==============================================================================
@app.get(
    "/api/v1/factores",
    response_model=List[FactorRiesgoDto],
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Consultar catálogo de factores de riesgo vial",
)
async def list_factores_riesgo(
    solo_activos: bool = Query(True, description="Retornar solo factores activos"),
    db: Session = Depends(get_db),
):
    """Configura factores de riesgo y ponderaciones del índice de priorización (RF-4)."""
    return crud_service.listar_factores_riesgo(db, solo_activos=solo_activos)


@app.post(
    "/api/v1/factores",
    response_model=FactorRiesgoDto,
    status_code=status.HTTP_201_CREATED,
    tags=["Factores y Ponderaciones"],
    summary="Registrar nuevo factor de riesgo",
)
async def create_factor_riesgo(
    payload: FactorRiesgoCreateRequest, db: Session = Depends(get_db)
):
    """Registra un nuevo factor de riesgo en el catálogo municipal (RF-4)."""
    return crud_service.crear_factor_riesgo(db, payload)


@app.patch(
    "/api/v1/factores/{id_factor}",
    response_model=FactorRiesgoDto,
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Modificar o activar/desactivar factor de riesgo",
)
async def update_factor_riesgo(
    id_factor: int = Path(...),
    payload: FactorRiesgoUpdateRequest = ...,
    db: Session = Depends(get_db),
):
    """Actualiza descripción o estado activo de un factor (RF-4)."""
    f = crud_service.actualizar_factor_riesgo(db, id_factor, payload)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factor de riesgo no encontrado",
        )
    return f


@app.get(
    "/api/v1/factores/ponderaciones",
    response_model=PonderacionesScoringDto,
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Consultar ponderaciones vigentes del índice",
)
async def get_ponderaciones_vigentes(db: Session = Depends(get_db)):
    """Retorna la configuración activa de pesos del índice multicriterio (RF-4, RB-8)."""
    return crud_service.obtener_ponderaciones()


@app.put(
    "/api/v1/factores/ponderaciones",
    response_model=PonderacionesScoringDto,
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Calibrar y versionar ponderaciones del índice",
)
async def update_ponderaciones(
    payload: PonderacionesUpdateRequest, db: Session = Depends(get_db)
):
    """Calibra y versiona las ponderaciones del índice de priorización (RF-4, RB-8)."""
    return crud_service.calibrar_ponderaciones(payload)


# ==============================================================================
# 8. FICHAS DE INSPECCIÓN TÉCNICA (RF-5, RF-6, RF-7, RB-9 a RB-12)
# ==============================================================================
@app.post(
    "/api/v1/inspections",
    response_model=FichaInspeccionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Fichas de Inspección"],
    summary="Crear ficha de inspección de terreno",
)
async def create_ficha_inspeccion(
    payload: FichaInspeccionCreateRequest,
    db: Session = Depends(get_db),
):
    """Crea una ficha de inspección asociada a un punto con factores y observaciones (RF-5)."""
    return crud_service.crear_ficha_inspeccion(db, payload)


@app.get(
    "/api/v1/inspections/{id_ficha}",
    response_model=FichaInspeccionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Fichas de Inspección"],
    summary="Consultar detalle de una ficha de inspección",
)
async def get_ficha_inspeccion_by_id(
    id_ficha: int = Path(...), db: Session = Depends(get_db)
):
    """Retorna la información completa de una ficha de inspección técnica."""
    f = crud_service.obtener_ficha_por_id(db, id_ficha)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficha de inspección no encontrada",
        )
    return f


@app.patch(
    "/api/v1/inspections/{id_ficha}",
    response_model=FichaInspeccionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Fichas de Inspección"],
    summary="Editar ficha de inspección propia",
)
async def update_ficha_inspeccion(
    id_ficha: int = Path(...),
    payload: FichaInspeccionUpdateRequest = ...,
    db: Session = Depends(get_db),
):
    """Actualiza observaciones de una ficha existente de autoría propia (RF-7, RB-11)."""
    f = crud_service.actualizar_ficha_inspeccion(db, id_ficha, payload)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficha de inspección no encontrada",
        )
    return f


@app.post(
    "/api/v1/inspections/{id_ficha}/fotos",
    response_model=FotografiaResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Fichas de Inspección"],
    summary="Adjuntar fotografía de evidencia a una ficha",
)
async def upload_foto_inspeccion(
    id_ficha: int = Path(...),
    db: Session = Depends(get_db),
):
    """Adjunta evidencia fotográfica a una ficha de inspección (RF-5, RB-10, RNF-S-7)."""
    return crud_service.agregar_fotografia_ficha(db, id_ficha)


@app.get(
    "/api/v1/puntos/{id_punto}/fichas",
    response_model=List[FichaInspeccionResponse],
    status_code=status.HTTP_200_OK,
    tags=["Fichas de Inspección"],
    summary="Consultar historial cronológico de fichas de un punto crítico",
)
async def get_historial_fichas_punto(
    id_punto: int = Path(...),
    db: Session = Depends(get_db),
):
    """Consulta el historial de fichas de inspección asociadas a un punto (RF-6, RB-12)."""
    return crud_service.listar_fichas_de_punto(db, id_punto)


# ==============================================================================
# 9. ALERTAS DE PROXIMIDAD - CLIENTE MÓVIL (RF-8, RB-13, RB-14, RNF-S-8)
# ==============================================================================
@app.post(
    "/api/v1/alerts",
    response_model=AlertCheckResponse,
    status_code=status.HTTP_200_OK,
    tags=["Alertas Proximidad"],
    summary="Evaluar telemetría de vehículo para alerta de proximidad",
)
async def evaluate_proximity_alert(
    payload: AlertCheckRequest,
    db: Session = Depends(get_db),
):
    """Evalúa coordenadas para activar alerta de proximidad a puntos críticos (RF-8, RNF-S-8)."""
    return spatial_service.evaluar_alerta_proximidad(db, payload)


# ==============================================================================
# 10. AUDITORÍA Y TRAZABILIDAD (RNF-S-4, tabla `evento_auditoria`)
# ==============================================================================
@app.get(
    "/api/v1/auditoria",
    response_model=AuditoriaListResponse,
    status_code=status.HTTP_200_OK,
    tags=["Auditoría y Trazabilidad"],
    summary="Consultar bitácora inmutable de auditoría",
)
async def get_eventos_auditoria(
    accion: Optional[str] = Query(None, description="Filtrar por código de acción"),
    id_usuario: Optional[int] = Query(None, description="Filtrar por usuario"),
    limit: Optional[int] = Query(50, description="Límite de registros"),
    offset: Optional[int] = Query(0, description="Desplazamiento"),
    db: Session = Depends(get_db),
):
    """Consulta el registro y trazabilidad de eventos del sistema. Exclusivo Administrador (RNF-S-4)."""
    return crud_service.listar_eventos_auditoria(
        db, accion=accion, id_usuario=id_usuario, limit=limit or 50, offset=offset or 0
    )
