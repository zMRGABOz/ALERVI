"""
Configuracion de conexion a la base de datos PostgreSQL/PostGIS.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Crea el motor SQLAlchemy, la factoria de sesiones y la dependencia
`get_db` para inyeccion en los endpoints de FastAPI.
"""

from typing import Generator

from app.core.config import settings

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session, declarative_base, sessionmaker

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

except ImportError:
    # Soporte de modo desarrollo/pruebas si SQLAlchemy aun no esta instalado en el venv local
    engine = None
    SessionLocal = None

    class _MockMetadata:
        tables = {
            "comuna": None,
            "punto_critico": None,
            "registro": None,
            "elemento_urbano": None,
            "usuario": None,
            "factor_riesgo": None,
            "ficha_inspeccion": None,
            "registra": None,
            "fotografia": None,
            "evento_auditoria": None,
        }

    class _MockBase:
        metadata = _MockMetadata()

    Base = _MockBase  # type: ignore
    Session = object  # type: ignore

    def get_db():
        yield None
