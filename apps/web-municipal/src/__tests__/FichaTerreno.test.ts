/**
 * Suite de pruebas unitarias para el módulo FichaTerreno (TC-14, TC-15, TC-16, TC-18, TC-20, TC-21).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { obtenerFechaHoyLocal } from "../components/FichaTerreno/FormFicha";
import {
  ordenarFichasCronologicamente,
  puedeEditarFicha,
} from "../components/FichaTerreno/HistorialFichas";
import { validarSeleccionFotografias } from "../components/FichaTerreno/UploadFotos";
import type { FichaInspeccion } from "../components/FichaTerreno/types";

describe("FichaTerreno — Validaciones y Reglas de Negocio", () => {
  test("TC-14: obtenerFechaHoyLocal retorna formato YYYY-MM-DD local válido", () => {
    const fecha = obtenerFechaHoyLocal();
    assert.match(fecha, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("TC-18: ordenarFichasCronologicamente ordena de más reciente a más antigua según fecha_registro", () => {
    const fichasDesordenadas: FichaInspeccion[] = [
      {
        id_ficha: 1,
        id_punto: 101,
        id_inspector: 2,
        fecha_visita: "2026-10-10",
        fecha_registro: "2026-10-10T10:00:00Z",
        notas: "Primera ficha",
        factores_riesgo: [],
        fotografias: [],
      },
      {
        id_ficha: 3,
        id_punto: 101,
        id_inspector: 2,
        fecha_visita: "2026-11-05",
        fecha_registro: "2026-11-05T15:30:00Z",
        notas: "Tercera ficha (más reciente)",
        factores_riesgo: [],
        fotografias: [],
      },
      {
        id_ficha: 2,
        id_punto: 101,
        id_inspector: 2,
        fecha_visita: "2026-10-25",
        fecha_registro: "2026-10-25T12:00:00Z",
        notas: "Segunda ficha",
        factores_riesgo: [],
        fotografias: [],
      },
    ];

    const ordenadas = ordenarFichasCronologicamente(fichasDesordenadas);
    assert.deepEqual(
      ordenadas.map((f) => f.id_ficha),
      [3, 2, 1]
    );
  });

  test("TC-18: desempate por id_ficha descendente cuando fecha_registro no está presente y fecha_visita coincide", () => {
    const fichasMismaFecha: FichaInspeccion[] = [
      {
        id_ficha: 10,
        id_punto: 101,
        id_inspector: 2,
        fecha_visita: "2026-11-01",
        factores_riesgo: [],
        fotografias: [],
      },
      {
        id_ficha: 12,
        id_punto: 101,
        id_inspector: 2,
        fecha_visita: "2026-11-01",
        factores_riesgo: [],
        fotografias: [],
      },
    ];

    const ordenadas = ordenarFichasCronologicamente(fichasMismaFecha);
    assert.equal(ordenadas[0].id_ficha, 12);
    assert.equal(ordenadas[1].id_ficha, 10);
  });

  test("TC-20 y TC-21: puedeEditarFicha permite edición solo al Inspector autor y deniega a otro Inspector o Administrador", () => {
    const fichaInspector2 = { id_inspector: 2 };

    // TC-20: Inspector autor (id = 2)
    assert.equal(puedeEditarFicha(fichaInspector2, "inspector", 2), true);

    // TC-21: Otro Inspector (id = 5)
    assert.equal(puedeEditarFicha(fichaInspector2, "inspector", 5), false);

    // RB-11: Administrador (aunque coincida ID)
    assert.equal(puedeEditarFicha(fichaInspector2, "administrador", 2), false);
  });

  test("TC-15 y TC-16: validarSeleccionFotografias controla máximo 3 fotos, formato JPEG/PNG y peso <= 5 MB", () => {
    const fotoValida = { name: "perspectiva_conductor.jpg", type: "image/jpeg", size: 1024 * 500 };

    // TC-15: Archivo válido dentro del límite
    assert.equal(validarSeleccionFotografias(2, [fotoValida]), null);

    // TC-16: Cuarta fotografía rechazada con mensaje exacto del SRS
    assert.equal(
      validarSeleccionFotografias(3, [fotoValida]),
      "La ficha admite un máximo de 3 fotografías"
    );

    // TC-16: Formato inválido (PDF / GIF)
    const archivoInvalido = { name: "documento.pdf", type: "application/pdf", size: 1024 };
    assert.match(
      validarSeleccionFotografias(0, [archivoInvalido]) || "",
      /Solo se admiten formatos JPEG o PNG/
    );

    // TC-16: Archivo mayor a 5 MB
    const archivoPesado = {
      name: "foto_alta_res.png",
      type: "image/png",
      size: 6 * 1024 * 1024,
    };
    assert.match(
      validarSeleccionFotografias(0, [archivoPesado]) || "",
      /excede el límite de 5 MB/
    );
  });
});
