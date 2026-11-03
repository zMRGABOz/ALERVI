"""
Configuracion de conexion a la base de datos PostgreSQL/PostGIS.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Crea el motor SQLAlchemy, la factoria de sesiones y la dependencia
`get_db` para inyeccion en los endpoints de FastAPI.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings

# Motor de conexion hacia PostgreSQL / PostGIS
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=False,
)

# Factoria de sesiones transaccionales
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base declarativa para modelos ORM
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Generador de sesion de base de datos para inyectar via Depends(get_db).
    Garantiza el cierre seguro de la conexion al finalizar la peticion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
