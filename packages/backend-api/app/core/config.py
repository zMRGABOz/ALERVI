"""
Configuracion centralizada del backend.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Lee variables de entorno (o .env) y las expone como un objeto tipado.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracion de la aplicacion, poblada desde variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -- Base de datos --
    database_url: str = (
        "postgresql://alervi_user:alervi_dev_2026@localhost:5432/alervi_db"
    )

    # -- Seguridad --
    backend_secret_key: str = "dev-secret-key-cambiar-en-prod"
    backend_debug: bool = True

    # -- CORS --
    backend_cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        """Parsea la cadena de origenes separados por coma en una lista."""
        return [origin.strip() for origin in self.backend_cors_origins.split(",")]


settings = Settings()
