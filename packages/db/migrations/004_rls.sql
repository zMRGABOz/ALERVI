-- ==========================================
-- ALERVI -- Migracion 004: Row Level Security
-- ==========================================

-- Activa RLS en todas las tablas y le da acceso solo al rol de la API
-- Sin politica, un rol ve 0 filas: anon y authenticated (API REST de Supabase) quedan sin acceso
-- Que operaciones puede hacer alervi_app lo siguen definiendo los GRANT de la migracion 003

BEGIN;

ALTER TABLE comuna           ENABLE ROW LEVEL SECURITY;
ALTER TABLE punto_critico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro         ENABLE ROW LEVEL SECURITY;
ALTER TABLE elemento_urbano  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE factor_riesgo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ficha_inspeccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE registra         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotografia       ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY acceso_api ON comuna           FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON punto_critico    FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON registro         FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON elemento_urbano  FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON usuario          FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON factor_riesgo    FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON ficha_inspeccion FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON registra         FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON fotografia       FOR ALL TO alervi_app USING (true) WITH CHECK (true);
CREATE POLICY acceso_api ON evento_auditoria FOR ALL TO alervi_app USING (true) WITH CHECK (true);

COMMIT;