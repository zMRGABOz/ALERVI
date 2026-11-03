-- ============================================
-- ALERVI -- Seed 001: Datos base de desarrollo
-- ============================================

-- Datos para entornos locales, pobla la BD con datos que no pueden provenir de un archivo externo

BEGIN;

-- Contraseña local para el rol de la API
ALTER ROLE alervi_app PASSWORD 'alervi_app_dev_2026';

-- COMUNA
-- Poligono provisorio, corresponde a un rectangulo aproximado al rededor de Concepción
INSERT INTO comuna (codigo_comuna, nombre, geometry) VALUES
    ('08101', 'Concepción', ST_Multi(ST_MakeEnvelope(-73.12, -36.88, -72.95, -36.74, 4326)));

-- USUARIO
-- Clave de ambas: Dev-2026-ALERVI (Se guarda el hash)
INSERT INTO usuario (correo, hash_clave, rol) VALUES
    ('admin@alervi.test', '$2b$12$FftZVwmTG1VxkseqE1Wy.OT1qUesa6jeaq4Sb.IsJAzKSMhV2NtYO', 'administrador'),
    ('inspector@alervi.test', '$2b$12$FftZVwmTG1VxkseqE1Wy.OT1qUesa6jeaq4Sb.IsJAzKSMhV2NtYO', 'inspector');

INSERT INTO factor_riesgo (nombre, descripcion) VALUES
    ('Poca visibilidad',        'Obstáculos o geometría que limitan la visión del conductor'),
    ('Falta de señalización',   'Señales o demarcación ausentes, dañadas o poco visibles'),
    ('Exceso de velocidad',     'Velocidad de circulación observada superior a la segura'),
    ('Cruce peatonal inseguro', 'Cruce sin protección adecuada para peatones'),
    ('Iluminación deficiente',  'Iluminación insuficiente en horario nocturno');

COMMIT;