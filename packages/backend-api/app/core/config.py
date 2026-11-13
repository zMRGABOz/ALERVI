"""
Configuracion centralizada del backend.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Lee variables de entorno (o .env) y las expone como un objeto tipado.
"""

import os
from pathlib import Path
from typing import List

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import (
        BaseModel as BaseSettings,  # fallback para entornos sin pydantic-settings
    )

    SettingsConfigDict = None


def _load_env_fallback() -> None:
    """Carga variables desde archivos .env a os.environ si no estan cargadas ya."""
    parents = Path(__file__).resolve().parents
    candidates = [Path.cwd() / ".env"]
    if len(parents) > 2:
        candidates.append(parents[2] / ".env")
    if len(parents) > 4:
        candidates.append(parents[4] / ".env")
    for env_path in candidates:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if key and key not in os.environ:
                            os.environ[key] = val
            except Exception:
                pass


_load_env_fallback()


class Settings(BaseSettings):
    """Configuracion de la aplicacion, poblada desde variables de entorno."""

    if SettingsConfigDict is not None:
        model_config = SettingsConfigDict(
            env_file=(".env", "../../.env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )

    # -- Base de datos --
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://alervi_user:alervi_dev_2026@localhost:5432/alervi_db",
    )

    # -- Parametros de pool para control de cuotas (Plan Gratuito) --
    db_pool_size: int = int(os.getenv("DB_POOL_SIZE", "5"))
    db_max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "2"))
    db_pool_timeout: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    db_pool_recycle: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))
    db_use_null_pool: bool = os.getenv("DB_USE_NULL_POOL", "false").lower() in (
        "1",
        "true",
        "yes",
    )
    db_ssl_require: bool = os.getenv("DB_SSL_REQUIRE", "false").lower() in (
        "1",
        "true",
        "yes",
    )

    # -- Seguridad --
    backend_secret_key: str = os.getenv(
        "BACKEND_SECRET_KEY", "dev-secret-key-cambiar-en-prod"
    )
    backend_debug: bool = os.getenv("BACKEND_DEBUG", "true").lower() in (
        "1",
        "true",
        "yes",
    )

    # -- CORS --
    backend_cors_origins: str = os.getenv(
        "BACKEND_CORS_ORIGINS", "http://localhost:3000"
    )

    @property
    def cors_origins(self) -> List[str]:
        """Parsea la cadena de origenes separados por coma en una lista."""
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def sqlalchemy_database_url(self) -> str:
        """
        Normaliza la URL de base de datos para SQLAlchemy 2.0 y psycopg2.
        Convierte 'postgres://' y 'postgresql://' a 'postgresql+psycopg2://'.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def is_remote_db(self) -> bool:
        """Determina si la base de datos apunta a un host remoto fuera del entorno local."""
        url_lower = self.database_url.lower()
        local_hosts = ("localhost", "127.0.0.1", "@db:", "@db/")
        return not any(lh in url_lower for lh in local_hosts)


settings = Settings()
