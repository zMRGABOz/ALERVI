"""
ALERVI Backend API -- Entry Point
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Alerta y Evaluacion de Riesgo Vial.

Levantar en desarrollo:
    uvicorn app.main:app --reload --port 8000

Documentacion interactiva:
    http://localhost:8000/docs    (Swagger UI)
    http://localhost:8000/redoc   (ReDoc)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title="ALERVI API",
    description="Alerta y Evaluacion de Riesgo Vial -- Backend REST API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# -- CORS ----------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Health check ---------------------------------------------------
@app.get("/health", tags=["ops"])
async def health_check():
    """Endpoint de salud. Usado por Docker healthcheck y monitoring."""
    return {
        "status": "ok",
        "service": "alervi-api",
        "version": "0.1.0",
    }


@app.get("/", tags=["ops"])
async def root():
    """Redirige a la documentacion interactiva."""
    return {
        "message": "ALERVI API esta corriendo",
        "docs": "/docs",
    }
