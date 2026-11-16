-- Datos sintéticos exclusivos del esquema temporal de pytest.
INSERT INTO comuna (codigo_comuna, nombre, geometry)
VALUES ('08101', 'Concepción', ST_Multi(ST_MakeEnvelope(-73.1, -36.9, -73.0, -36.8, 4326)));

INSERT INTO punto_critico (id_punto, geometry) OVERRIDING SYSTEM VALUE VALUES
    (101, ST_SetSRID(ST_MakePoint(-73.0543, -36.8271), 4326)),
    (102, ST_SetSRID(ST_MakePoint(-73.07, -36.85), 4326)),
    (103, ST_SetSRID(ST_MakePoint(-73.08, -36.86), 4326)),
    (104, ST_SetSRID(ST_MakePoint(-73.09, -36.87), 4326));
SELECT setval('punto_critico_id_punto_seq', 104);

INSERT INTO registro
    (id_punto, anio, cantidad_siniestros, fallecidos, graves, menos_graves, leves)
VALUES
    (101, 2024, 40, 3, 8, 4, 10),
    (101, 2025, 10, 1, 2, 1, 3),
    (102, 2024, 8, 0, 1, 0, 2),
    (103, 2024, 1, 0, 0, 0, 1);

INSERT INTO elemento_urbano
    (osm_id, osm_tipo, categoria, nombre, geometry)
VALUES
    (1001, 'node', 'colegio', 'Colegio de prueba', ST_SetSRID(ST_MakePoint(-73.0543, -36.8266), 4326)),
    (1002, 'node', 'paradero', 'Paradero de prueba', ST_SetSRID(ST_MakePoint(-73.0543, -36.8269), 4326));

INSERT INTO usuario (id_usuario, correo, hash_clave, rol, activo)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'admin@alervi.test', %(password_hash)s, 'administrador', true),
    (2, 'inspector@alervi.test', %(password_hash)s, 'inspector', true),
    (99, 'otro_inspector@alervi.test', %(password_hash)s, 'inspector', true);
SELECT setval('usuario_id_usuario_seq', 99);

INSERT INTO factor_riesgo (id_factor, nombre, descripcion, activo)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'Visibilidad reducida', 'Factor sintético de prueba', true),
    (2, 'Señalización', 'Segundo factor sintético', true);
SELECT setval('factor_riesgo_id_factor_seq', 2);

INSERT INTO ficha_inspeccion
    (id_ficha, id_punto, id_usuario, fecha_visita, notas)
OVERRIDING SYSTEM VALUE VALUES
    (1, 101, 2, CURRENT_DATE, 'Ficha sintética inicial');
SELECT setval('ficha_inspeccion_id_ficha_seq', 1);
INSERT INTO registra (id_ficha, id_factor) VALUES (1, 1);
