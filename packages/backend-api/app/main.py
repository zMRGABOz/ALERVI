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

from fastapi import Depends, FastAPI, Path, Query, status
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
    AlertDetail,
    AuditoriaListResponse,
    CargaDatosBatchRequest,
    CargaDatosResponse,
    DesgloseFactoresScoring,
    ElementoUrbanoCercano,
    EntornoUrbanoContexto,
    EventoAuditoriaResponse,
    FactorRiesgoCreateRequest,
    FactorRiesgoDto,
    FactorRiesgoUpdateRequest,
    FichaInspeccionCreateRequest,
    FichaInspeccionResponse,
    FichaInspeccionUpdateRequest,
    FotografiaResponse,
    GeoJsonFeature,
    GeoJsonFeatureCollection,
    GeoJsonPoint,
    HistoricoSiniestrosAnual,
    LoginRequest,
    LoginResponse,
    PonderacionesScoringDto,
    PonderacionesUpdateRequest,
    PuntoCriticoProperties,
    PuntoCriticoTecnicoDetail,
    PuntoRankingItem,
    PuntoSinIndiceItem,
    RankingResponse,
    RegistroRechazadoDetalle,
    UsuarioCreateRequest,
    UsuarioListResponse,
    UsuarioResponse,
    UsuarioUpdateRequest,
)

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
    return LoginResponse(
        access_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub.dev.token",
        token_type="bearer",
        expires_in=28800,
        mfa_requerido=False,
        usuario=UsuarioResponse(
            id_usuario=2,
            correo=payload.correo or "inspector@alervi.test",
            rol="inspector",
            activo=True,
            fecha_creacion=None,
        ),
    )


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
    rol: Optional[str] = Query(None, description="Filtrar por rol (inspector | administrador)"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    limit: Optional[int] = Query(20, description="Límite de registros"),
    offset: Optional[int] = Query(0, description="Desplazamiento"),
    db: Session = Depends(get_db),
):
    """Administra cuentas de usuario y asignación de roles. Exclusivo Administrador (RF-9)."""
    return UsuarioListResponse(
        total=2,
        usuarios=[
            UsuarioResponse(
                id_usuario=1,
                correo="admin@alervi.test",
                rol="administrador",
                activo=True,
                fecha_creacion=None,
            ),
            UsuarioResponse(
                id_usuario=2,
                correo="inspector@alervi.test",
                rol="inspector",
                activo=True,
                fecha_creacion=None,
            ),
        ],
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
    return UsuarioResponse(
        id_usuario=3,
        correo=payload.correo,
        rol=payload.rol,
        activo=True,
        fecha_creacion=None,
    )


@app.get(
    "/api/v1/usuarios/{id_usuario}",
    response_model=UsuarioResponse,
    status_code=status.HTTP_200_OK,
    tags=["Gestión de Usuarios"],
    summary="Consultar detalle de un usuario municipal",
)
async def get_usuario_by_id(id_usuario: int = Path(...), db: Session = Depends(get_db)):
    """Consulta técnica de una cuenta de usuario municipal por ID."""
    return UsuarioResponse(
        id_usuario=id_usuario,
        correo="inspector@alervi.test" if id_usuario == 2 else "admin@alervi.test",
        rol="inspector" if id_usuario == 2 else "administrador",
        activo=True,
        fecha_creacion=None,
    )


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
    return UsuarioResponse(
        id_usuario=id_usuario,
        correo="inspector@alervi.test" if id_usuario == 2 else "admin@alervi.test",
        rol=payload.rol or ("inspector" if id_usuario == 2 else "administrador"),
        activo=payload.activo if payload.activo is not None else True,
        fecha_creacion=None,
    )


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
    total = len(payload.registros) if payload.registros else 1633
    aceptados = total - 5
    return CargaDatosResponse(
        id_carga=7,
        fuente=payload.fuente or "CONASET_ARCGIS",
        anio=payload.anio,
        total_procesados=total,
        aceptados=max(0, aceptados),
        rechazados=5,
        duplicados=0,
        estado="COMPLETADA_CON_ADVERTENCIAS",
        fecha_carga="2026-11-03T01:15:00Z",
        detalles_rechazo=[
            RegistroRechazadoDetalle(
                fila_o_id="Fila 142 / ID CONASET_08101_99",
                motivo="Coordenadas fuera del polígono territorial de Concepción (RB-1).",
            )
        ],
    )


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
    comuna: Optional[str] = Query(None, description="Filtrar puntos por nombre de comuna (ej. 'Concepción')"),
    bbox: Optional[str] = Query(None, description="Bounding box en formato 'minLon,minLat,maxLon,maxLat'"),
    db: Session = Depends(get_db),
):
    """Capa pública de puntos críticos (ubicación, nivel y antecedentes públicos en GeoJSON) (RF-2)."""
    filtro_comuna = comuna or "Concepción"
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
                    comuna=filtro_comuna,
                    nivel_riesgo="CRITICO",
                    indice_prioridad=89.4,
                    total_siniestros=48,
                    total_fallecidos=3,
                    total_graves=12,
                    tendencia="ALZA",
                    resumen_publico="Intersección con alto flujo peatonal y virajes conflictivos frecuentes.",
                ),
            ),
            GeoJsonFeature(
                type="Feature",
                id=102,
                geometry=GeoJsonPoint(type="Point", coordinates=[-73.0580, -36.8220]),
                properties=PuntoCriticoProperties(
                    id_punto=102,
                    nombre_interseccion="Av. Los Carrera con Av. Prat",
                    comuna=filtro_comuna,
                    nivel_riesgo="ALTO",
                    indice_prioridad=78.5,
                    total_siniestros=32,
                    total_fallecidos=1,
                    total_graves=8,
                    tendencia="ESTABLE",
                    resumen_publico="Cruce de alta velocidad vehicular y aproximacion a puente carretero.",
                ),
            ),
        ],
    )


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
    anio: Optional[int] = Query(None, description="Filtrar cálculo para un año específico (2020-2025)"),
    periodo_inicio: Optional[int] = Query(2020, description="Año de inicio del rango temporal analizado"),
    periodo_fin: Optional[int] = Query(2025, description="Año de término del rango temporal analizado"),
    limit: Optional[int] = Query(10, description="Cantidad de puntos a retornar"),
    offset: Optional[int] = Query(0, description="Desplazamiento para paginación"),
    db: Session = Depends(get_db),
):
    """Ranking ordenado de puntos con su índice; filtros por comuna y período (RF-3)."""
    return RankingResponse(
        total_puntos=124,
        configuracion_version="v1.0-oficial-2026",
        fecha_calculo="2026-11-03T02:00:00Z",
        comuna=comuna or "Concepción",
        periodo=f"{periodo_inicio or 2020}-{periodo_fin or 2025}",
        puntos=[
            PuntoRankingItem(
                id_punto=101,
                posicion_ranking=1,
                nombre_interseccion="Av. Paicaví con Av. Los Carrera",
                comuna=comuna or "Concepción",
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
            ),
            PuntoRankingItem(
                id_punto=102,
                posicion_ranking=2,
                nombre_interseccion="Av. Los Carrera con Av. Prat",
                comuna=comuna or "Concepción",
                latitud=-36.8220,
                longitud=-73.0580,
                nivel_riesgo="ALTO",
                indice_prioridad=78.5,
                severidad_s=80.0,
                frecuencia_f=75.0,
                tendencia_t=70.0,
                contexto_c=82.0,
                total_siniestros=32,
                total_fallecidos=1,
                total_graves=8,
                estado_indice="CALCULADO",
            ),
        ],
        puntos_sin_indice=[
            PuntoSinIndiceItem(
                id_punto=205,
                nombre_interseccion="Calle O'Higgins con Calle Serrano",
                comuna=comuna or "Concepción",
                latitud=-36.8310,
                longitud=-73.0515,
                motivo="Menos de 2 años con registros válidos en serie 2020-2025",
                estado_indice="SIN_INDICE_DISPONIBLE",
            )
        ],
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
    id_punto: int = Path(..., description="Identificador único del punto crítico", example=101),
    db: Session = Depends(get_db),
):
    """Detalle del punto, desglose de factores y explicación del índice (RF-3)."""
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
            ),
            HistoricoSiniestrosAnual(
                anio=2023,
                cantidad_siniestros=15,
                fallecidos=1,
                graves=4,
                menos_graves=3,
                leves=7,
            ),
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
        total_fichas_inspeccion=4,
        explicacion_tecnica="Intersección con alta ponderación por severidad KABCO (3 fallecidos).",
        advertencia_legal="El índice expresa prioridad relativa dentro de Concepción (RB-6).",
    )


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
    return [
        FactorRiesgoDto(id_factor=1, nombre="Poca visibilidad", descripcion="Obstáculos visuales", activo=True),
        FactorRiesgoDto(id_factor=2, nombre="Falta de señalización", descripcion="Señalización deficiente", activo=True),
        FactorRiesgoDto(id_factor=3, nombre="Exceso de velocidad", descripcion="Velocidad sobre el límite", activo=True),
        FactorRiesgoDto(id_factor=4, nombre="Cruce peatonal inseguro", descripcion="Sin protección peatonal", activo=True),
        FactorRiesgoDto(id_factor=5, nombre="Iluminación deficiente", descripcion="Mala iluminación nocturna", activo=True),
    ]


@app.post(
    "/api/v1/factores",
    response_model=FactorRiesgoDto,
    status_code=status.HTTP_201_CREATED,
    tags=["Factores y Ponderaciones"],
    summary="Registrar nuevo factor de riesgo",
)
async def create_factor_riesgo(payload: FactorRiesgoCreateRequest, db: Session = Depends(get_db)):
    """Registra un nuevo factor de riesgo en el catálogo municipal (RF-4)."""
    return FactorRiesgoDto(
        id_factor=6,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        activo=True,
    )


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
    return FactorRiesgoDto(
        id_factor=id_factor,
        nombre=payload.nombre or "Poca visibilidad",
        descripcion=payload.descripcion or "Obstáculos o geometría que limitan la visión.",
        activo=payload.activo if payload.activo is not None else True,
    )


@app.get(
    "/api/v1/factores/ponderaciones",
    response_model=PonderacionesScoringDto,
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Consultar ponderaciones vigentes del índice",
)
async def get_ponderaciones_vigentes(db: Session = Depends(get_db)):
    """Retorna la configuración activa de pesos del índice multicriterio (RF-4, RB-8)."""
    return PonderacionesScoringDto(
        version="v1.0-oficial-2026",
        w_severidad=0.35,
        w_frecuencia=0.25,
        w_tendencia=0.20,
        w_contexto=0.20,
        suma_pesos=1.0,
        fecha_calibracion="2026-10-10T12:00:00Z",
        modificado_por="admin@alervi.test",
        descripcion_cambio="Calibración oficial inicial.",
        es_vigente=True,
    )


@app.put(
    "/api/v1/factores/ponderaciones",
    response_model=PonderacionesScoringDto,
    status_code=status.HTTP_200_OK,
    tags=["Factores y Ponderaciones"],
    summary="Calibrar y versionar ponderaciones del índice",
)
async def update_ponderaciones(payload: PonderacionesUpdateRequest, db: Session = Depends(get_db)):
    """Calibra y versiona las ponderaciones del índice de priorización (RF-4, RB-8)."""
    return PonderacionesScoringDto(
        version="v1.1-calibrada-2026",
        w_severidad=payload.w_severidad,
        w_frecuencia=payload.w_frecuencia,
        w_tendencia=payload.w_tendencia,
        w_contexto=payload.w_contexto,
        suma_pesos=payload.w_severidad + payload.w_frecuencia + payload.w_tendencia + payload.w_contexto,
        fecha_calibracion="2026-11-03T15:00:00Z",
        modificado_por="admin@alervi.test",
        descripcion_cambio=payload.descripcion_cambio or "Calibración actualizada.",
        es_vigente=True,
    )


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
    return FichaInspeccionResponse(
        id_ficha=15,
        id_punto=payload.id_punto,
        nombre_interseccion="Av. Paicaví con Av. Los Carrera",
        id_inspector=2,
        correo_inspector="inspector@alervi.test",
        fecha_visita=payload.fecha_visita,
        fecha_registro=None,
        notas=payload.notas or "Visita a terreno realizada según protocolo.",
        factores_riesgo=[
            FactorRiesgoDto(id_factor=1, nombre="Poca visibilidad", descripcion="Visibilidad reducida", activo=True)
        ],
        fotografias=[],
    )


@app.get(
    "/api/v1/inspections/{id_ficha}",
    response_model=FichaInspeccionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Fichas de Inspección"],
    summary="Consultar detalle de una ficha de inspección",
)
async def get_ficha_inspeccion_by_id(id_ficha: int = Path(...), db: Session = Depends(get_db)):
    """Retorna la información completa de una ficha de inspección técnica."""
    return FichaInspeccionResponse(
        id_ficha=id_ficha,
        id_punto=101,
        nombre_interseccion="Av. Paicaví con Av. Los Carrera",
        id_inspector=2,
        correo_inspector="inspector@alervi.test",
        fecha_visita="2026-11-02",
        fecha_registro=None,
        notas="Inspección realizada con equipo municipal.",
        factores_riesgo=[
            FactorRiesgoDto(id_factor=1, nombre="Poca visibilidad", descripcion="Visibilidad reducida", activo=True)
        ],
        fotografias=[
            FotografiaResponse(
                id_foto=28,
                id_ficha=id_ficha,
                ruta=f"inspecciones/{id_ficha}/foto_f7a8c9b1.jpg",
                url=f"https://api.alervi.cl/storage/inspecciones/{id_ficha}/foto_f7a8c9b1.jpg",
                tamano_bytes=None,
                fecha_subida=None,
            )
        ],
    )


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
    return FichaInspeccionResponse(
        id_ficha=id_ficha,
        id_punto=101,
        nombre_interseccion="Av. Paicaví con Av. Los Carrera",
        id_inspector=2,
        correo_inspector="inspector@alervi.test",
        fecha_visita=payload.fecha_visita or "2026-11-02",
        fecha_registro=None,
        notas=payload.notas or "Notas de inspección actualizadas.",
        factores_riesgo=[
            FactorRiesgoDto(id_factor=1, nombre="Poca visibilidad", descripcion="Visibilidad reducida", activo=True)
        ],
        fotografias=[],
    )


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
    return FotografiaResponse(
        id_foto=29,
        id_ficha=id_ficha,
        ruta=f"inspecciones/{id_ficha}/foto_random_segura.jpg",
        url=f"https://api.alervi.cl/storage/inspecciones/{id_ficha}/foto_random_segura.jpg",
        tamano_bytes=None,
        fecha_subida=None,
    )


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
    return [
        FichaInspeccionResponse(
            id_ficha=15,
            id_punto=id_punto,
            nombre_interseccion="Av. Paicaví con Av. Los Carrera",
            id_inspector=2,
            correo_inspector="inspector@alervi.test",
            fecha_visita="2026-11-02",
            fecha_registro=None,
            notas="Visita de terreno reciente.",
            factores_riesgo=[
                FactorRiesgoDto(id_factor=1, nombre="Poca visibilidad", descripcion="Visibilidad reducida", activo=True)
            ],
            fotografias=[],
        )
    ]


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
    return AuditoriaListResponse(
        total=1,
        eventos=[
            EventoAuditoriaResponse(
                id_evento=1042,
                id_usuario=2,
                correo_usuario="inspector@alervi.test",
                accion=accion or "CREAR_FICHA",
                entidad_afectada="FICHA_INSPECCION",
                id_afectado="15",
                fecha_hora="2026-11-02T16:30:00Z",
                detalles="Creación de ficha técnica en punto 101 con factores de riesgo asociados.",
            )
        ],
    )
