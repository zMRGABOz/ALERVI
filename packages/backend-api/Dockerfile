# ============================================================
#  ALERVI Backend — Dockerfile
# ============================================================
FROM python:3.12-slim AS base

WORKDIR /code

# -- Dependencias del sistema (psycopg2, PostGIS) --
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc \
       libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# -- Dependencias Python --
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# -- Codigo fuente --
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
