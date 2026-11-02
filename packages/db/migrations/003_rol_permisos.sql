-- ==========================================
-- ALERVI -- Migracion 003: Roles y permisos
-- ==========================================

-- Crea un rol con menos permisos, la API se conecta a la BD con este rol

BEGIN;

-- Creacion del rol si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alervi_app') THEN
        CREATE ROLE alervi_app LOGIN;
    END IF;
END
$$;

-- Permisos de solo lectura
-- Debido a que estos datos son dados por la carga inicial con los datos de CONASET
GRANT SELECT ON comuna, punto_critico, registro, elemento_urbano TO alervi_app;

-- Permisos de lectura y escritura
-- Debido a que estas tablas corresponden a los resultados dados por los inspectores
GRANT SELECT, INSERT, UPDATE, DELETE ON ficha_inspeccion, registra, fotografia TO alervi_app;

-- Permisos sin DELETE
-- La cuentas y los factores no se eliminan, se desactivan
GRANT SELECT, INSERT, UPDATE ON usuario, factor_riesgo TO alervi_app;

-- Permisos de solo lectura en insercion
-- Los eventos de auditorias no se eliminan solo se insertan
GRANT SELECT, INSERT ON evento_auditoria TO alervi_app;

COMMIT;