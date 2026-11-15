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
    from sqlalchemy.pool import NullPool, QueuePool

    # Determinar si la conexion remota requiere argumentos SSL
    connect_args = {}
    if settings.is_remote_db or settings.db_ssl_require:
        if "sslmode" not in settings.sqlalchemy_database_url:
            connect_args["sslmode"] = "require"

    # Motor de conexion hacia PostgreSQL / PostGIS con proteccion de cuotas de conexion
    if settings.db_use_null_pool:
        # Ideal para Transaction Poolers externos (ej. PgBouncer / Supabase puerto 6543)
        engine = create_engine(
            settings.sqlalchemy_database_url,
            poolclass=NullPool,
            connect_args=connect_args,
        )
    else:
        # QueuePool con limites estrictos para no saturar cuotas de plan gratuito
        engine = create_engine(
            settings.sqlalchemy_database_url,
            poolclass=QueuePool,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,
            pool_pre_ping=settings.db_pool_pre_ping,
            connect_args=connect_args,
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
