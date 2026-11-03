FROM python:3.12-slim

# Cliente de PostgreSQL
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /datos
COPY ingest/requirements.txt ingest/requirements.txt
RUN pip install --no-cache-dir -r ingest/requirements.txt

COPY ingest/ ingest/
COPY seeds/ seeds/

RUN sed -i 's/\r$//' ingest/cargar_datos.sh

CMD ["sh", "ingest/cargar_datos.sh"]