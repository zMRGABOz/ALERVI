"""
Pruebas de configuracion y conexion de base de datos para ALERVI Backend API.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica la lectura dinamica de DATABASE_URL, normalizacion de protocolos,
deteccion de bases de datos remotas y parametros de pool para cuotas gratuitas.
"""

from app.core.config import Settings
from app.core.database import get_db


def test_url_normalization_postgres_prefix():
    """Verifica que 'postgres://' se transforme a 'postgresql+psycopg2://'."""
    s = Settings(database_url="postgres://user:secret@cloud.db.host:5432/alervi")
    assert (
        s.sqlalchemy_database_url
        == "postgresql+psycopg2://user:secret@cloud.db.host:5432/alervi"
    )


def test_url_normalization_postgresql_standard_prefix():
    """Verifica que 'postgresql://' se transforme a 'postgresql+psycopg2://'."""
    s = Settings(database_url="postgresql://user:secret@cloud.db.host:5432/alervi")
    assert (
        s.sqlalchemy_database_url
        == "postgresql+psycopg2://user:secret@cloud.db.host:5432/alervi"
    )


def test_url_normalization_preserved_driver():
    """Verifica que URLs con driver explicito como 'postgresql+psycopg2://' se preserven."""
    url = "postgresql+psycopg2://user:secret@cloud.db.host:5432/alervi"
    s = Settings(database_url=url)
    assert s.sqlalchemy_database_url == url


def test_is_remote_db_detection():
    """Verifica la clasificacion entre bases locales y remotas para politicas de SSL."""
    # Locales
    assert not Settings(
        database_url="postgresql://usr:pwd@localhost:5432/db"
    ).is_remote_db
    assert not Settings(
        database_url="postgresql://usr:pwd@127.0.0.1:5432/db"
    ).is_remote_db
    assert not Settings(database_url="postgresql://usr:pwd@db:5432/db").is_remote_db

    # Remotas (ej. Supabase, Neon, Render)
    assert Settings(
        database_url="postgresql://usr:pwd@db.projectref.supabase.co:5432/postgres"
    ).is_remote_db
    assert Settings(
        database_url="postgresql://usr:pwd@ep-dry-pond-1234.us-east-2.aws.neon.tech/neondb"
    ).is_remote_db
    assert Settings(
        database_url="postgresql://usr:pwd@dpg-abcdef.oregon-postgres.render.com/alervi"
    ).is_remote_db


def test_pool_settings_defaults():
    """Verifica que los parametros de pool tengan valores por defecto seguros para plan gratuito."""
    s = Settings()
    assert s.db_pool_size >= 1
    assert s.db_max_overflow >= 0
    assert s.db_pool_timeout > 0
    assert s.db_pool_recycle > 0
    assert isinstance(s.db_use_null_pool, bool)
    assert isinstance(s.db_ssl_require, bool)


def test_cors_origins_parsing():
    """Verifica que los origenes CORS se separen adecuadamente sin espacios vacios."""
    s = Settings(backend_cors_origins="http://localhost:3000, https://alervi.cl, ")
    origins = s.cors_origins
    assert "http://localhost:3000" in origins
    assert "https://alervi.cl" in origins
    assert "" not in origins


def test_get_db_generator():
    """Verifica que el generador get_db funcione correctamente."""
    generator = get_db()
    db_session = next(generator)
    # En entorno sin base conectada o fallback mock, retorna None o Session
    assert db_session is None or hasattr(db_session, "close")
    try:
        next(generator)
    except StopIteration:
        pass


def test_env_inline_comments_sanitization():
    """Verifica que valores de entorno con comentarios inline '# ...' se saniticen."""
    s = Settings(
        db_pool_size="8 # tamaño del pool",
        db_max_overflow="4 # overflow admitido",
        db_pool_timeout="45 # timeout en seg",
        db_pool_recycle="1200 # recycle",
        db_use_null_pool="true # usar null pool",
        db_ssl_require="false # sin ssl",
        backend_debug="false # debug inactivo",
    )
    assert s.db_pool_size == 8
    assert s.db_max_overflow == 4
    assert s.db_pool_timeout == 45
    assert s.db_pool_recycle == 1200
    assert s.db_use_null_pool is True
    assert s.db_ssl_require is False
    assert s.backend_debug is False


def test_load_env_fallback_resilience():
    """Verifica que _load_env_fallback no falle por IndexError al resolver rutas."""
    from app.core.config import _load_env_fallback

    # No debe arrojar ninguna excepcion
    _load_env_fallback()
