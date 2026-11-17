-- ============================================================
--  ALERVI -- Migracion 005: indices funcionales geodesicos
-- ============================================================
-- Acelera las consultas espaciales en metros (ST_DWithin con cast a Geography)
-- permitiendo que PostGIS use indices GIST en lugar de escaneos secuenciales.

BEGIN;

-- Indice espacial funcional sobre elemento_urbano (cast a geography)
CREATE INDEX IF NOT EXISTS idx_elemento_urbano_geog 
    ON elemento_urbano USING GIST (cast(geometry AS geography));

-- Indice espacial funcional sobre punto_critico (cast a geography)
CREATE INDEX IF NOT EXISTS idx_punto_critico_geog 
    ON punto_critico USING GIST (cast(geometry AS geography));

COMMIT;
