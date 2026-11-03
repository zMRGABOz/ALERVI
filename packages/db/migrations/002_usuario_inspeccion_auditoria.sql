-- ============================================================
-- ALERVI -- Migracion 002: usuarios, inspecciones y auditoria
-- ============================================================

-- Crea las tablas: usuario, factor_riesgo, ficha_inspeccion, registra, fotografia, evento_auditoria

BEGIN;

-- USUARIO
-- Roles de inspectores y administradores. Las cuentas se desactivan no se eliminan.
CREATE TABLE usuario (
    id_usuario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo     text NOT NULL UNIQUE CHECK (correo = lower(correo) and correo ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
    hash_clave text NOT NULL,
    rol        text NOT NULL CHECK (rol IN ('inspector', 'administrador')),
    activo     boolean NOT NULL DEFAULT true
);

-- FACTOR_RIESGO
-- Catalogo de factores que se marcan en una ficha
CREATE TABLE factor_riesgo (
    id_factor   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      text NOT NULL UNIQUE CHECK (char_length(nombre) BETWEEN 1 AND 60 AND nombre = btrim(nombre)),
    descripcion text,
    activo      boolean NOT NULL DEFAULT true
);

-- FICHA_INSPECCION
-- Una visita de un inspector a un punto critico
CREATE TABLE ficha_inspeccion (
    id_ficha     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_punto     integer NOT NULL REFERENCES punto_critico (id_punto),
    id_usuario   integer NOT NULL REFERENCES usuario(id_usuario),
    fecha_visita date NOT NULL DEFAULT CURRENT_DATE CHECK (fecha_visita <= CURRENT_DATE),
    notas        text CHECK (char_length(notas) <= 500)
);

CREATE INDEX idx_ficha_inspeccion_punto ON ficha_inspeccion (id_punto);

-- REGISTRA (Tabla intermedia entre FICHA_INSPECCION y FACTOR_RIESGO)
-- Al eliminar una ficha se eliminan sus filas en esta tabla (cascade)
CREATE TABLE registra (
    id_ficha  integer NOT NULL REFERENCES ficha_inspeccion(id_ficha) ON DELETE CASCADE,
    id_factor integer NOT NULL REFERENCES factor_riesgo(id_factor),
    PRIMARY KEY (id_ficha, id_factor)
);

-- FOTOGRAFIA
-- La BD solo guarda la ruta, el archivo se guarda en un disco externo
CREATE TABLE fotografia (
    id_foto  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha integer NOT NULL REFERENCES ficha_inspeccion(id_ficha),
    ruta     text NOT NULL UNIQUE CHECK(ruta !~ '(^/|\.\.)' AND ruta ~* '\.(jpe?g|png)$')
);

CREATE INDEX idx_fotografia_ficha ON fotografia (id_ficha);

-- EVENTO AUDITORIA
-- Registro de quien hizo que y cuando. Esta tabla es solo para insercion
CREATE TABLE evento_auditoria (
    id_evento        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario       integer REFERENCES usuario(id_usuario),
    accion           text NOT NULL CHECK(accion IN ('login_ok', 'login_fallido', 'ficha_crear', 'ficha_editar', 'ficha_eliminar', 'foto_subir', 'foto_eliminar', 'usuario_crear', 'usuario_editar', 'factor_crear', 'factor_editar')),
    fecha_hora       timestamptz NOT NULL DEFAULT now(),
    entidad_afectada text,
    id_afectado      integer CHECK ((entidad_afectada IS NULL) = (id_afectado IS NULL))
);

COMMIT;