"""
Esquemas Pydantic para el API de ALERVI segun el contrato OpenAPI 3.1.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Define las estructuras de datos para solicitudes y respuestas de los
endpoints del sistema ALERVI:
- Autenticacion (/api/v1/auth/login)
- Gestion de Usuarios (/api/v1/usuarios)
- Ingesta y Cargas (/api/v1/cargas)
- Mapa Publico / Capa GeoJSON (/api/v1/publico/riesgo)
- Ranking Jerarquizado (/api/v1/ranking)
- Detalle Tecnico de Punto Critico (/api/v1/puntos/{id_punto})
- Factores y Ponderaciones (/api/v1/factores)
- Fichas de Inspeccion y Fotos (/api/v1/inspections)
- Historial de Fichas por Punto (/api/v1/puntos/{id_punto}/fichas)
- Evaluacion de Alertas (/api/v1/alerts)
- Auditoria y Trazabilidad (/api/v1/auditoria)
"""

from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================================
# 1. AUTENTICACIÓN Y SESIÓN (tabla `usuario`)
# ============================================================================
class LoginRequest(BaseModel):
    correo: str = Field(..., example="inspector.vial@concepcion.cl", description="Correo institucional")
    password: str = Field(..., example="ClaveSegura2026*", description="Contraseña del funcionario")
    codigo_mfa: Optional[str] = Field(None, pattern=r"^[0-9]{6}$", example="482910", description="Código TOTP de 6 dígitos")


class UsuarioResponse(BaseModel):
    id_usuario: int = Field(..., example=3)
    correo: str = Field(..., example="inspector.vial@concepcion.cl")
    rol: str = Field(..., example="inspector", description="inspector | administrador")
    activo: bool = Field(..., example=True)
    fecha_creacion: Optional[str] = Field(
        None,
        example="2026-10-15T09:00:00Z",
        description="Marca temporal (opcional según persistencia en BD)",
    )


class LoginResponse(BaseModel):
    access_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    token_type: str = Field(default="bearer", example="bearer")
    expires_in: int = Field(..., example=28800, description="Tiempo de validez de la sesión en segundos")
    mfa_requerido: bool = Field(default=False, example=False)
    usuario: UsuarioResponse


# ============================================================================
# 2. GESTIÓN DE USUARIOS (tabla `usuario`)
# ============================================================================
class UsuarioCreateRequest(BaseModel):
    correo: str = Field(..., example="nuevo.inspector@concepcion.cl")
    clave: str = Field(..., min_length=8, example="TempoPassword2026*")
    rol: str = Field(..., example="inspector", description="inspector | administrador")


class UsuarioUpdateRequest(BaseModel):
    rol: Optional[str] = Field(None, example="inspector", description="inspector | administrador")
    activo: Optional[bool] = Field(None, example=True, description="Desactivación lógica de la cuenta")
    clave_nueva: Optional[str] = Field(None, min_length=8, example="NuevaClaveSegura2026*")


class UsuarioListResponse(BaseModel):
    total: int = Field(..., example=10)
    usuarios: List[UsuarioResponse]


# ============================================================================
# 3. INGESTA Y CARGAS VIALES (CONASET)
# ============================================================================
class RegistroSiniestroIngesta(BaseModel):
    id_origen: Optional[str] = Field(None, example="CONASET_CCP_2024_08101_042")
    nombre_interseccion: Optional[str] = Field(None, example="Av. Paicaví con Av. Los Carrera")
    comuna: Optional[str] = Field("Concepción", example="Concepción")
    latitud: float = Field(..., example=-36.8271)
    longitud: float = Field(..., example=-73.0543)
    cantidad_siniestros: int = Field(..., ge=1, example=12)
    fallecidos: int = Field(default=0, ge=0, example=1)
    graves: int = Field(default=0, ge=0, example=4)
    menos_graves: int = Field(default=0, ge=0, example=2)
    leves: int = Field(default=0, ge=0, example=5)


class CargaDatosBatchRequest(BaseModel):
    fuente: str = Field(..., example="CONASET_ARCGIS")
    anio: int = Field(..., ge=2020, le=2025, example=2024)
    descripcion: Optional[str] = Field(None, example="Lote de siniestros Concepción 2024")
    registros: List[RegistroSiniestroIngesta] = Field(default_factory=list)


class RegistroRechazadoDetalle(BaseModel):
    fila_o_id: str = Field(..., example="Fila 142 / ID CONASET_08101_99")
    motivo: str = Field(..., example="Coordenadas fuera del polígono territorial de Concepción (RB-1).")


class CargaDatosResponse(BaseModel):
    id_carga: int = Field(..., example=7)
    fuente: str = Field(..., example="CONASET_ARCGIS")
    anio: int = Field(..., example=2024)
    total_procesados: int = Field(..., example=1633)
    aceptados: int = Field(..., example=1580)
    rechazados: int = Field(..., example=45)
    duplicados: int = Field(..., example=8)
    estado: str = Field(default="COMPLETADA_CON_ADVERTENCIAS", example="COMPLETADA_CON_ADVERTENCIAS")
    fecha_carga: str = Field(..., example="2026-11-03T01:15:00Z")
    detalles_rechazo: List[RegistroRechazadoDetalle] = Field(default_factory=list)


# ============================================================================
# 4. MAPA PÚBLICO (tablas `punto_critico`, `comuna`, `registro`)
# ============================================================================
class GeoJsonPoint(BaseModel):
    type: str = Field(default="Point", example="Point")
    coordinates: List[float] = Field(
        ...,
        min_length=2,
        max_length=2,
        example=[-73.0543, -36.8271],
        description="[Longitud, Latitud] bajo WGS84 (SRID 4326)",
    )


class PuntoCriticoProperties(BaseModel):
    id_punto: int = Field(..., example=101)
    nombre_interseccion: str = Field(..., example="Av. Paicaví con Av. Los Carrera")
    comuna: str = Field(..., example="Concepción")
    nivel_riesgo: str = Field(..., example="ALTO", description="CRITICO | ALTO | MEDIO | BAJO")
    indice_prioridad: float = Field(..., example=78.5, ge=0.0, le=100.0)
    total_siniestros: int = Field(..., example=24)
    total_fallecidos: Optional[int] = Field(2, example=2)
    total_graves: Optional[int] = Field(7, example=7)
    tendencia: Optional[str] = Field("ALZA", example="ALZA", description="ALZA | ESTABLE | BAJA")
    resumen_publico: Optional[str] = Field(
        "Intersección con alto flujo peatonal y virajes conflictivos frecuentes.",
        example="Intersección con alto flujo peatonal y virajes conflictivos frecuentes."
    )


class GeoJsonFeature(BaseModel):
    type: str = Field(default="Feature", example="Feature")
    id: int = Field(..., example=101)
    geometry: GeoJsonPoint
    properties: PuntoCriticoProperties


class GeoJsonFeatureCollection(BaseModel):
    type: str = Field(default="FeatureCollection", example="FeatureCollection")
    features: List[GeoJsonFeature]


# ============================================================================
# 5. RANKING Y ANALÍTICA DSS (tablas `punto_critico`, `registro`, `elemento_urbano`)
# ============================================================================
class PuntoRankingItem(BaseModel):
    id_punto: int = Field(..., example=101)
    posicion_ranking: int = Field(..., example=1)
    nombre_interseccion: str = Field(..., example="Av. Paicaví con Av. Los Carrera")
    comuna: str = Field(..., example="Concepción")
    latitud: float = Field(..., example=-36.8271)
    longitud: float = Field(..., example=-73.0543)
    nivel_riesgo: str = Field(..., example="CRITICO")
    indice_prioridad: float = Field(..., example=89.4, ge=0.0, le=100.0)
    severidad_s: float = Field(..., example=92.0, ge=0.0, le=100.0)
    frecuencia_f: float = Field(..., example=85.5, ge=0.0, le=100.0)
    tendencia_t: float = Field(..., example=78.0, ge=0.0, le=100.0)
    contexto_c: float = Field(..., example=95.0, ge=0.0, le=100.0)
    total_siniestros: int = Field(..., example=48)
    total_fallecidos: int = Field(..., example=3)
    total_graves: int = Field(..., example=12)
    estado_indice: str = Field(default="CALCULADO", example="CALCULADO")


class PuntoSinIndiceItem(BaseModel):
    id_punto: int = Field(..., example=205)
    nombre_interseccion: str = Field(..., example="Calle O'Higgins con Calle Serrano")
    comuna: str = Field(..., example="Concepción")
    latitud: float = Field(..., example=-36.8310)
    longitud: float = Field(..., example=-73.0515)
    motivo: str = Field(..., example="Menos de 2 años con registros válidos en serie 2020-2025")
    estado_indice: str = Field(default="SIN_INDICE_DISPONIBLE", example="SIN_INDICE_DISPONIBLE")


class RankingResponse(BaseModel):
    total_puntos: int = Field(..., example=124)
    configuracion_version: str = Field(..., example="v1.0-oficial-2026")
    fecha_calculo: str = Field(..., example="2026-11-03T02:00:00Z")
    comuna: str = Field(..., example="Concepción")
    periodo: str = Field(..., example="2020-2025")
    puntos: List[PuntoRankingItem]
    puntos_sin_indice: List[PuntoSinIndiceItem] = Field(default_factory=list)


# ============================================================================
# 6. PUNTOS CRÍTICOS - DETALLE DSS INTERNO (tablas `punto_critico`, `registro`, `elemento_urbano`)
# ============================================================================
class DesgloseFactoresScoring(BaseModel):
    formula: str = Field(default="IP = w1*S + w2*F + w3*T + w4*C", example="IP = w1*S + w2*F + w3*T + w4*C")
    w_severidad: float = Field(..., example=0.35)
    severidad_s: float = Field(..., example=92.0)
    aporte_severidad: float = Field(..., example=32.2)
    w_frecuencia: float = Field(..., example=0.25)
    frecuencia_f: float = Field(..., example=85.5)
    aporte_frecuencia: float = Field(..., example=21.375)
    w_tendencia: float = Field(..., example=0.20)
    tendencia_t: float = Field(..., example=78.0)
    aporte_tendencia: float = Field(..., example=15.6)
    w_contexto: float = Field(..., example=0.20)
    contexto_c: float = Field(..., example=95.0)
    aporte_contexto: float = Field(..., example=19.0)


class HistoricoSiniestrosAnual(BaseModel):
    anio: int = Field(..., example=2024, ge=2020, le=2025)
    cantidad_siniestros: int = Field(..., example=12, ge=1)
    fallecidos: int = Field(..., example=1, ge=0)
    graves: int = Field(..., example=3, ge=0)
    menos_graves: int = Field(..., example=2, ge=0)
    leves: int = Field(..., example=6, ge=0)


class ElementoUrbanoCercano(BaseModel):
    id_elemento: int = Field(..., example=4501)
    nombre: Optional[str] = Field(None, example="Liceo Enrique Molina Garmendia")
    categoria: str = Field(..., example="colegio", description="colegio | paradero")
    distancia_m: int = Field(..., example=85)


class EntornoUrbanoContexto(BaseModel):
    buffer_metros: int = Field(default=150, example=150)
    total_colegios_buffer: int = Field(..., example=2)
    total_paraderos_buffer: int = Field(..., example=4)
    colegio_mas_cercano: Optional[ElementoUrbanoCercano] = None
    paradero_mas_cercano: Optional[ElementoUrbanoCercano] = None


class PuntoCriticoTecnicoDetail(BaseModel):
    id_punto: int = Field(..., example=101)
    nombre_interseccion: str = Field(..., example="Av. Paicaví con Av. Los Carrera")
    comuna: str = Field(..., example="Concepción")
    latitud: float = Field(..., example=-36.8271)
    longitud: float = Field(..., example=-73.0543)
    nivel_riesgo: str = Field(..., example="CRITICO")
    indice_prioridad: float = Field(..., example=89.4)
    estado_indice: str = Field(default="CALCULADO", example="CALCULADO")
    configuracion_pesos_version: str = Field(default="v1.0-oficial-2026", example="v1.0-oficial-2026")
    desglose_scoring: DesgloseFactoresScoring
    historico_anual: List[HistoricoSiniestrosAnual]
    entorno_urbano: EntornoUrbanoContexto
    total_fichas_inspeccion: int = Field(..., example=4)
    explicacion_tecnica: str = Field(
        ...,
        example="Intersección con alta ponderación por severidad KABCO (3 fallecidos) y buffer de 150 m con 2 colegios y 4 paraderos con alta tasa de virajes conflictivos."
    )
    advertencia_legal: str = Field(
        default="El índice expresa prioridad relativa dentro de Concepción. No representa probabilidad individual de sufrir un siniestro ni certifica la seguridad de la vía (RB-6).",
        example="El índice expresa prioridad relativa dentro de Concepción. No representa probabilidad individual de sufrir un siniestro ni certifica la seguridad de la vía (RB-6)."
    )


# ============================================================================
# 7. FACTORES Y PONDERACIONES (tabla `factor_riesgo`)
# ============================================================================
class FactorRiesgoDto(BaseModel):
    id_factor: int = Field(..., example=1)
    nombre: str = Field(..., max_length=60, example="Poca visibilidad")
    descripcion: Optional[str] = Field(None, example="Obstáculos o geometría que limitan la visión del conductor")
    activo: bool = Field(default=True, example=True)


class FactorRiesgoCreateRequest(BaseModel):
    nombre: str = Field(..., max_length=60, example="Cruce peatonal sin semáforo")
    descripcion: Optional[str] = Field(None, example="Paso de cebra con alto flujo escolar sin regulación semafórica.")


class FactorRiesgoUpdateRequest(BaseModel):
    nombre: Optional[str] = Field(None, max_length=60, example="Poca visibilidad corregida")
    descripcion: Optional[str] = Field(None)
    activo: Optional[bool] = Field(None, example=True)


class PonderacionesScoringDto(BaseModel):
    version: str = Field(..., example="v1.0-oficial-2026")
    w_severidad: float = Field(..., ge=0.0, le=1.0, example=0.35)
    w_frecuencia: float = Field(..., ge=0.0, le=1.0, example=0.25)
    w_tendencia: float = Field(..., ge=0.0, le=1.0, example=0.20)
    w_contexto: float = Field(..., ge=0.0, le=1.0, example=0.20)
    suma_pesos: float = Field(default=1.0, example=1.0)
    fecha_calibracion: str = Field(..., example="2026-10-10T12:00:00Z")
    modificado_por: str = Field(..., example="admin.transito@concepcion.cl")
    descripcion_cambio: Optional[str] = Field(None, example="Calibración oficial inicial.")
    es_vigente: bool = Field(default=True, example=True)


class PonderacionesUpdateRequest(BaseModel):
    w_severidad: float = Field(..., ge=0.0, le=1.0, example=0.40)
    w_frecuencia: float = Field(..., ge=0.0, le=1.0, example=0.20)
    w_tendencia: float = Field(..., ge=0.0, le=1.0, example=0.20)
    w_contexto: float = Field(..., ge=0.0, le=1.0, example=0.20)
    descripcion_cambio: Optional[str] = Field(None, example="Ajuste dando mayor ponderación a siniestros graves.")


# ============================================================================
# 8. FICHAS DE INSPECCIÓN TÉCNICA Y FOTOS (tablas `ficha_inspeccion`, `registra`, `fotografia`)
# ============================================================================
class FotografiaResponse(BaseModel):
    id_foto: int = Field(..., example=28)
    id_ficha: int = Field(..., example=15)
    ruta: str = Field(..., example="inspecciones/15/foto_f7a8c9b1.jpg")
    url: Optional[str] = Field(None, example="https://api.alervi.cl/storage/inspecciones/15/foto_f7a8c9b1.jpg")
    tamano_bytes: Optional[int] = Field(None, example=412500)
    fecha_subida: Optional[str] = Field(None, example="2026-11-02T16:35:10Z")


class FichaInspeccionCreateRequest(BaseModel):
    id_punto: int = Field(..., example=101, description="ID del punto crítico inspeccionado")
    fecha_visita: str = Field(..., example="2026-11-02", description="Fecha de visita (formato YYYY-MM-DD <= HOY)")
    notas: Optional[str] = Field(
        None,
        max_length=500,  # Restricción estricta de BD: CHECK (char_length(notas) <= 500)
        example="Se constata paradero colapsado en hora punta mañana con bloqueo de visión hacia el cruce.",
        description="Observaciones técnicas del inspector (máximo 500 caracteres según restricción SQL)",
    )
    factores_riesgo_ids: Optional[List[int]] = Field(
        default_factory=list,
        example=[1, 3],
        description="IDs de factores de riesgo activos observados (tabla registra)",
    )


class FichaInspeccionUpdateRequest(BaseModel):
    fecha_visita: Optional[str] = Field(None, example="2026-11-02", description="Fecha de visita (<= HOY)")
    notas: Optional[str] = Field(None, max_length=500, example="Actualización de notas de inspección.")
    factores_riesgo_ids: Optional[List[int]] = Field(None, example=[1, 2])


class FichaInspeccionResponse(BaseModel):
    id_ficha: int = Field(..., example=15)
    id_punto: int = Field(..., example=101)
    nombre_interseccion: str = Field(..., example="Av. Paicaví con Av. Los Carrera")
    id_inspector: int = Field(..., example=2, description="id_usuario en BD")
    correo_inspector: Optional[str] = Field("inspector.vial@concepcion.cl", example="inspector.vial@concepcion.cl")
    fecha_visita: str = Field(..., example="2026-11-02")
    fecha_registro: Optional[str] = Field(None, example="2026-11-02T16:30:00Z")
    notas: Optional[str] = Field(None, max_length=500, example="Paradero con sobredemanda de locomoción colectiva.")
    factores_riesgo: List[FactorRiesgoDto] = Field(default_factory=list)
    fotografias: List[FotografiaResponse] = Field(default_factory=list)


# ============================================================================
# 9. ALERTAS DE PROXIMIDAD (evaluadas en memoria, RNF-S-8)
# ============================================================================
class AlertCheckRequest(BaseModel):
    session_id: str = Field(..., example="9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", description="UUID de sesión de conducción")
    latitude: float = Field(..., ge=-90.0, le=90.0, example=-36.8285)
    longitude: float = Field(..., ge=-180.0, le=180.0, example=-73.0550)
    speed_mps: float = Field(..., ge=0.0, example=13.88, description="Velocidad instantánea en m/s")
    heading_degrees: Optional[float] = Field(None, ge=0.0, le=360.0, example=45.0)
    accuracy_m: Optional[float] = Field(None, ge=0.0, example=8.5)
    timestamp: str = Field(..., example="2026-11-03T02:30:00Z")


class AlertDetail(BaseModel):
    id_punto: int = Field(..., example=101)
    nombre_interseccion: str = Field(..., example="Av. Paicaví con Av. Los Carrera")
    nivel_riesgo: str = Field(..., example="ALTO", description="CRITICO | ALTO | MEDIO")
    distancia_m: float = Field(..., example=112.5)
    ttc_segundos: float = Field(..., example=8.1, description="Time-To-Collision (<= 12s)")
    mensaje_visual: str = Field(..., example="⚠️ Zona de Riesgo a 110 m: Paicaví / Carrera")
    patron_sonoro: str = Field(..., example="BEEP_PRECAUCION", description="BEEP_URGENTE | BEEP_PRECAUCION | TONO_CORTO")
    instruccion_seguridad: Optional[str] = Field(
        "Reduzca velocidad y preste atención al cruce",
        example="Reduzca velocidad y preste atención al cruce"
    )


class AlertCheckResponse(BaseModel):
    alerta_activa: bool = Field(..., example=True)
    telemetria_status: str = Field(
        ...,
        example="EVALUADO_CON_ALERTA",
        description="EVALUADO_CON_ALERTA | SUPRIMIDO_VELOCIDAD_BAJA | SUPRIMIDO_TRAYECTORIA_DIVERGENTE | SUPRIMIDO_TTC_MAYOR_12S | SUPRIMIDO_PUNTO_YA_ADVERTIDO | BAJA_PRECISION_GPS | TELEMETRIA_OBSOLETA | SIN_PUNTOS_EN_RANGO"
    )
    alerta: Optional[AlertDetail] = None


# ============================================================================
# 10. AUDITORÍA Y TRAZABILIDAD (tabla `evento_auditoria`)
# ============================================================================
class EventoAuditoriaResponse(BaseModel):
    id_evento: int = Field(..., example=1042)
    id_usuario: Optional[int] = Field(None, example=3)
    correo_usuario: Optional[str] = Field(None, example="inspector.vial@concepcion.cl")
    accion: str = Field(
        ...,
        example="CREAR_FICHA",
        description="LOGIN_CORRECTO | LOGIN_FALLIDO | LOGOUT | CREAR_FICHA | EDITAR_FICHA | ELIMINAR_FICHA | SUBIR_FOTO | ELIMINAR_FOTO | CREAR_USUARIO | EDITAR_USUARIO | DESACTIVAR_USUARIO | CREAR_FACTOR | EDITAR_FACTOR | CALIBRAR_PONDERACIONES | INGESTA_CONASET",
    )
    entidad_afectada: Optional[str] = Field(None, example="FICHA_INSPECCION")
    id_afectado: Optional[str] = Field(None, example="15")
    fecha_hora: str = Field(..., example="2026-11-02T16:30:00Z")
    detalles: Optional[str] = Field(None, example="Creación de ficha técnica en punto 101.")


class AuditoriaListResponse(BaseModel):
    total: int = Field(..., example=320)
    eventos: List[EventoAuditoriaResponse]
