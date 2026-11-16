"""Límite de persistencia: un fallo de PostgreSQL nunca se convierte en datos ficticios."""

import logging
from functools import wraps

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger(__name__)


def persistent(operation):
    """Exige una sesión real y revierte la transacción si la operación falla."""

    @wraps(operation)
    def wrapped(db, *args, **kwargs):
        if db is None:
            raise HTTPException(503, "La base de datos no está disponible.")
        try:
            return operation(db, *args, **kwargs)
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError as exc:
            db.rollback()
            logger.warning("Conflicto de persistencia en %s", operation.__name__)
            raise HTTPException(
                409, "La operación entra en conflicto con los datos almacenados."
            ) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            # No registrar parámetros SQL: pueden contener credenciales o telemetría GPS.
            logger.error(
                "Error de persistencia en %s (%s)",
                operation.__name__,
                type(exc).__name__,
            )
            raise HTTPException(
                503, "No fue posible completar la operación en la base de datos."
            ) from exc

    return wrapped
