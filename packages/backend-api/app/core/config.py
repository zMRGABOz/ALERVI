"""
Configuracion centralizada del backend.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Lee variables de entorno (o .env) y las expone como un objeto tipado.
"""

import os
from pathlib import Path
from typing import Any, List, Optional

try:
    from pydantic import field_validator
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import (
        BaseModel as BaseSettings,  # fallback para entornos sin pydantic-settings
    )

    SettingsConfigDict = None

    try:
        from pydantic import field_validator
    except ImportError:

        def field_validator(*args, **kwargs):  # type: ignore
            def decorator(f):
                return f

            return decorator


def _clean_env(val: Optional[str], default: str = "") -> str:
    """Limpia comentarios inline ('# ...') y espacios de una variable de entorno."""
    raw = val if val is not None else default
    return raw.split("#")[0].strip().strip("'\"")


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
                        val = _clean_env(val)
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
    database_url: str = _clean_env(
        os.getenv("DATABASE_URL"),
        "postgresql://alervi_user:alervi_dev_2026@localhost:5432/alervi_db",
    )

    # -- Parametros de pool para control de cuotas (Plan Gratuito) --
    db_pool_size: int = int(_clean_env(os.getenv("DB_POOL_SIZE"), "5"))
    db_max_overflow: int = int(_clean_env(os.getenv("DB_MAX_OVERFLOW"), "2"))
    db_pool_timeout: int = int(_clean_env(os.getenv("DB_POOL_TIMEOUT"), "30"))
    db_pool_recycle: int = int(_clean_env(os.getenv("DB_POOL_RECYCLE"), "1800"))
    db_use_null_pool: bool = _clean_env(
        os.getenv("DB_USE_NULL_POOL"), "false"
    ).lower() in (
        "1",
        "true",
        "yes",
    )
    db_ssl_require: bool = _clean_env(os.getenv("DB_SSL_REQUIRE"), "false").lower() in (
        "1",
        "true",
        "yes",
    )
    db_pool_pre_ping: bool = _clean_env(
        os.getenv("DB_POOL_PRE_PING"), "false"
    ).lower() in (
        "1",
        "true",
        "yes",
    )

    # -- Seguridad --
    backend_secret_key: str = _clean_env(
        os.getenv("BACKEND_SECRET_KEY"), "dev-secret-key-cambiar-en-prod"
    )
    backend_debug: bool = _clean_env(os.getenv("BACKEND_DEBUG"), "true").lower() in (
        "1",
        "true",
        "yes",
    )
    auth_max_failed_attempts: int = int(
        _clean_env(os.getenv("AUTH_MAX_FAILED_ATTEMPTS"), "5")
    )
    auth_lockout_duration_seconds: int = int(
        _clean_env(os.getenv("AUTH_LOCKOUT_DURATION_SECONDS"), "900")
    )
    auth_lockout_status_code: int = int(
        _clean_env(os.getenv("AUTH_LOCKOUT_STATUS_CODE"), "403")
    )
    admin_mfa_default_code: str = _clean_env(
        os.getenv("ADMIN_MFA_DEFAULT_CODE"),
        "482910"
        if _clean_env(os.getenv("BACKEND_DEBUG"), "true").lower()
        in ("1", "true", "yes")
        else "",
    )
    admin_totp_secret: str = _clean_env(
        os.getenv("ADMIN_TOTP_SECRET"), "JBSWY3DPEHPK3PXP"
    )

    # -- CORS --
    backend_cors_origins: str = _clean_env(
        os.getenv("BACKEND_CORS_ORIGINS"), "http://localhost:3000"
    )

    # -- Supabase Storage (RF-5, RB-10, RNF-S-7) --
    supabase_url: str = _clean_env(
        os.getenv("SUPABASE_URL"),
        "https://zguajlreoeuvypylvbxh.supabase.co",
    )
    supabase_key: str = _clean_env(
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY"),
        "",
    )
    supabase_storage_bucket: str = _clean_env(
        os.getenv("SUPABASE_STORAGE_BUCKET"),
        "fichas",
    )

    @field_validator(
        "db_pool_size",
        "db_max_overflow",
        "db_pool_timeout",
        "db_pool_recycle",
        "db_use_null_pool",
        "db_ssl_require",
        "backend_debug",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def _strip_inline_comments(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _clean_env(v)
        return v

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
