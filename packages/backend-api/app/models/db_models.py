"""
Modelos ORM de SQLAlchemy y GeoAlchemy2
"""

from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ============================================================================
# 1. DATOS GEOESPACIALES (001_datos_geoespaciales.sql)
# ============================================================================
class Comuna(Base):
    """
    Poligono territorial de la comuna.
    Los puntos criticos no guardan la comuna por ID, se asocian mediante consulta espacial.
    """
    __tablename__ = "comuna"

    codigo_comuna = Column(Text, primary_key=True)
    nombre = Column(Text, nullable=False, unique=True)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False)


class PuntoCritico(Base):
    """
    Ubicacion geoespacial unica de una interseccion o punto de siniestralidad.
    """
    __tablename__ = "punto_critico"

    id_punto = Column(Integer, primary_key=True, autoincrement=True)
    geometry = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False, unique=True)

    # Relaciones
    registros = relationship("Registro", back_populates="punto", cascade="all, delete-orphan")
    fichas = relationship("FichaInspeccion", back_populates="punto")


class Registro(Base):
    """
    Consolidado anual de siniestros KABCO para un punto critico.
    """
    __tablename__ = "registro"

    id_punto = Column(Integer, ForeignKey("punto_critico.id_punto"), primary_key=True)
    anio = Column(SmallInteger, primary_key=True)
    cantidad_siniestros = Column(Integer, nullable=False)
    fallecidos = Column(Integer, nullable=False, default=0)
    graves = Column(Integer, nullable=False, default=0)
    menos_graves = Column(Integer, nullable=False, default=0)
    leves = Column(Integer, nullable=False, default=0)

    # Relacion
    punto = relationship("PuntoCritico", back_populates="registros")


class ElementoUrbano(Base):
    """
    Equipamiento urbano de proximidad OSM (colegios y paraderos de transporte).
    """
    __tablename__ = "elemento_urbano"

    id_elemento = Column(Integer, primary_key=True, autoincrement=True)
    osm_id = Column(BigInteger, nullable=False)
    osm_tipo = Column(Text, nullable=False)
    categoria = Column(
        Enum("colegio", "paradero", name="categoria_urbana", create_type=False),
        nullable=False,
    )
    nombre = Column(Text, nullable=True)
    geometry = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)


# ============================================================================
# 2. USUARIOS, INSPECCIONES Y AUDITORÍA (002_usuario_inspeccion_auditoria.sql)
# ============================================================================
class Usuario(Base):
    """
    Cuentas de funcionarios municipales (inspectores y administradores).
    Las cuentas no se eliminan fisicamente, se desactivan (activo = false).
    """
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    correo = Column(Text, nullable=False, unique=True)
    hash_clave = Column(Text, nullable=False)
    rol = Column(Text, nullable=False)
    activo = Column(Boolean, nullable=False, default=True)

    # Relaciones
    fichas = relationship("FichaInspeccion", back_populates="usuario")
    eventos_auditoria = relationship("EventoAuditoria", back_populates="usuario")


class FactorRiesgo(Base):
    """
    Catalogo de factores de riesgo observables en terreno.
    """
    __tablename__ = "factor_riesgo"

    id_factor = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(Text, nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)

    # Relacion N:M con fichas
    fichas = relationship("FichaInspeccion", secondary="registra", back_populates="factores_riesgo")


# Tabla intermedia N:M entre ficha_inspeccion y factor_riesgo
registra = Table(
    "registra",
    Base.metadata,
    Column("id_ficha", Integer, ForeignKey("ficha_inspeccion.id_ficha", ondelete="CASCADE"), primary_key=True),
    Column("id_factor", Integer, ForeignKey("factor_riesgo.id_factor"), primary_key=True),
)


class FichaInspeccion(Base):
    """
    Ficha de levantamiento tecnico en terreno efectuada por un inspector.
    Restriccion en BD: notas de maximo 500 caracteres y fecha_visita <= hoy.
    """
    __tablename__ = "ficha_inspeccion"

    id_ficha = Column(Integer, primary_key=True, autoincrement=True)
    id_punto = Column(Integer, ForeignKey("punto_critico.id_punto"), nullable=False)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
    fecha_visita = Column(Date, nullable=False, default=date.today)
    notas = Column(Text, nullable=True)

    # Relaciones
    punto = relationship("PuntoCritico", back_populates="fichas")
    usuario = relationship("Usuario", back_populates="fichas")
    factores_riesgo = relationship("FactorRiesgo", secondary=registra, back_populates="fichas")
    fotografias = relationship("Fotografia", back_populates="ficha", cascade="all, delete-orphan")


class Fotografia(Base):
    """
    Ruta relativa al archivo de imagen de evidencia almacenado en disco/storage.
    """
    __tablename__ = "fotografia"

    id_foto = Column(Integer, primary_key=True, autoincrement=True)
    id_ficha = Column(Integer, ForeignKey("ficha_inspeccion.id_ficha"), nullable=False)
    ruta = Column(Text, nullable=False, unique=True)

    # Relacion
    ficha = relationship("FichaInspeccion", back_populates="fotografias")


class EventoAuditoria(Base):
    """
    Bitacora inmutable de eventos criticos de seguridad y gestion.
    """
    __tablename__ = "evento_auditoria"

    id_evento = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
    accion = Column(Text, nullable=False)
    fecha_hora = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    entidad_afectada = Column(Text, nullable=True)
    id_afectado = Column(Integer, nullable=True)

    # Relacion
    usuario = relationship("Usuario", back_populates="eventos_auditoria")
