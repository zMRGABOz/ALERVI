"""
Paquete de modelos ORM (SQLAlchemy / GeoAlchemy2) de ALERVI API.
"""

from app.core.database import Base

try:
    from app.models.db_models import (
        Comuna,
        ElementoUrbano,
        EventoAuditoria,
        FactorRiesgo,
        FichaInspeccion,
        Fotografia,
        PuntoCritico,
        Registro,
        Usuario,
        registra,
    )
except ImportError:
    Comuna = None
    ElementoUrbano = None
    EventoAuditoria = None
    FactorRiesgo = None
    FichaInspeccion = None
    Fotografia = None
    PuntoCritico = None
    Registro = None
    Usuario = None
    registra = None

__all__ = [
    "Base",
    "Comuna",
    "ElementoUrbano",
    "EventoAuditoria",
    "FactorRiesgo",
    "FichaInspeccion",
    "Fotografia",
    "PuntoCritico",
    "Registro",
    "Usuario",
    "registra",
]
