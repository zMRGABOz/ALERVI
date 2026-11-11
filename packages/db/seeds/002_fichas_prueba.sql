-- ============================================
-- ALERVI -- Seed 002: Fichas de prueba
-- ============================================

-- Datos para entornos locales. Debe ejecutarse DESPUES de cargar punto_critico y registro
-- Las fichas se asignan a los 3 puntos con mas siniestros (posicion 1 = el mas critico)

BEGIN;

BEGIN;

WITH top AS (
    SELECT id_punto, row_number() OVER (ORDER BY sum(cantidad_siniestros) DESC, id_punto) AS pos
    FROM registro
    GROUP BY id_punto
    ORDER BY pos
    LIMIT 3
)

INSERT INTO ficha_inspeccion (id_punto, id_usuario, fecha_visita, notas)
SELECT t.id_punto, v.id_usuario, v.fecha_visita::date, v.notas
FROM (VALUES
    (1, 2, '2025-03-10', 'Cruce sin semáforo, alto flujo peatonal.'),
    (2, 2, '2025-04-22', NULL),
    (3, 1, '2025-05-05', 'Señalética desgastada.'),
    (1, 2, '2025-09-18', 'Segunda visita: paso peatonal repintado, persiste la iluminación deficiente.')
) AS v(pos, id_usuario, fecha_visita, notas)
JOIN top t ON t.pos = v.pos
ORDER BY v.fecha_visita;

-- Factores: 1 Poca visibilidad, 2 Falta de señalización, 3 Exceso de velocidad, 4 Cruce peatonal inseguro, 5 Iluminación deficiente
INSERT INTO registra (id_ficha, id_factor) VALUES
    (1, 4),
    (1, 2),
    (2, 1),
    (3, 2),
    (3, 5),
    (4, 5);

INSERT INTO fotografia (id_ficha, ruta) VALUES
    (1, 'fichas/2025/03/ficha_001_a.jpg'),
    (1, 'fichas/2025/03/ficha_001_b.jpg'),
    (3, 'fichas/2025/05/ficha_003_a.png'),
    (4, 'fichas/2025/09/ficha_004_a.jpg');

COMMIT;