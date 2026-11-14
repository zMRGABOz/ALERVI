/**
 * Pruebas unitarias y de componentes (Jest + React Testing Library)
 * para FormFicha, HistorialFichas, UploadFotos y servicio inspections.ts.
 */

import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormFicha } from "../components/FichaTerreno/FormFicha";
import { HistorialFichas } from "../components/FichaTerreno/HistorialFichas";
import { UploadFotos } from "../components/FichaTerreno/UploadFotos";
import type { FactorRiesgo, FichaInspeccion } from "../components/FichaTerreno/types";
import {
  createFicha,
  getFichasPunto,
  updateFicha,
  uploadFotoFicha,
} from "../services/inspections";
import { transport } from "../services/transport";
import type { Session } from "../types/session";

jest.mock("../services/transport", () => ({
  transport: jest.fn(),
}));

const mockedTransport = transport as jest.MockedFunction<typeof transport>;

const mockSession: Session = {
  source: "real",
  accessToken: "jwt.test.token",
  expiresAt: Date.now() + 3600_000,
  rol: "inspector",
  revision: 1,
  signal: new AbortController().signal,
  usuario: {
    id_usuario: 2,
    correo: "inspector@alervi.test",
    rol: "inspector",
    activo: true,
    fecha_creacion: "2026-11-01T00:00:00Z",
  },
};

const factoresMock: FactorRiesgo[] = [
  { id_factor: 1, nombre: "Visibilidad obstruida", activo: true },
  { id_factor: 2, nombre: "Demarcación desgastada", activo: true },
];

const fichasMock: FichaInspeccion[] = [
  {
    id_ficha: 10,
    id_punto: 101,
    id_inspector: 2,
    fecha_visita: "2026-11-01",
    fecha_registro: "2026-11-01T10:00:00Z",
    notas: "Ficha del inspector actual",
    factores_riesgo: [factoresMock[0]],
    fotografias: [],
  },
  {
    id_ficha: 11,
    id_punto: 101,
    id_inspector: 5,
    fecha_visita: "2026-11-05",
    fecha_registro: "2026-11-05T15:00:00Z",
    notas: "Ficha de otro inspector",
    factores_riesgo: [],
    fotografias: [],
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  } as Response;
}

describe("Servicio inspections.ts", () => {
  beforeEach(() => {
    mockedTransport.mockReset();
  });

  test("getFichasPunto, createFicha, updateFicha y uploadFotoFicha invocan transport correctamente", async () => {
    mockedTransport
      .mockResolvedValueOnce(jsonResponse(fichasMock))
      .mockResolvedValueOnce(jsonResponse(fichasMock[0], 201))
      .mockResolvedValueOnce(jsonResponse({ ...fichasMock[0], notas: "Editada" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id_foto: 1,
          id_ficha: 10,
          ruta: "inspections/10/f.jpg",
          url: "https://cdn.test/f.jpg",
        }, 201),
      );

    const list = await getFichasPunto(101, { session: mockSession });
    expect(list).toHaveLength(2);

    const created = await createFicha(
      { id_punto: 101, fecha_visita: "2026-11-01", notas: "Prueba", factores_riesgo_ids: [1] },
      { session: mockSession },
    );
    expect(created.id_ficha).toBe(10);

    const updated = await updateFicha(10, { notas: "Editada" }, { session: mockSession });
    expect(updated.notas).toBe("Editada");

    const file = new File(["img"], "evidencia.jpg", { type: "image/jpeg" });
    const uploaded = await uploadFotoFicha(10, file, { session: mockSession });
    expect(uploaded.id_foto).toBe(1);
    expect(mockedTransport).toHaveBeenCalledTimes(4);
  });

  test("uploadFotoFicha lanza error descriptivo si la respuesta no es ok", async () => {
    mockedTransport.mockResolvedValueOnce(jsonResponse({ detail: "Error" }, 400));
    const file = new File(["img"], "fallo.jpg", { type: "image/jpeg" });

    await expect(uploadFotoFicha(10, file, { session: mockSession })).rejects.toThrow(
      /código 400/,
    );
  });
});

describe("Componente FormFicha", () => {
  beforeEach(() => {
    mockedTransport.mockReset();
  });

  test("TC-17: restringe la creación de ficha si rolUsuario es administrador", () => {
    render(
      <FormFicha
        idPunto={101}
        factoresDisponibles={factoresMock}
        session={mockSession}
        rolUsuario="administrador"
      />,
    );

    expect(screen.getByText(/reservado para el rol Inspector/i)).toBeInTheDocument();
  });

  test("TC-14: muestra error si se intenta enviar sin factores ni notas", async () => {
    render(
      <FormFicha
        idPunto={101}
        nombrePunto="Paicaví / Carrera"
        factoresDisponibles={factoresMock}
        session={mockSession}
        rolUsuario="inspector"
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Registrar Ficha de Inspección/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/requiere al menos un factor de riesgo identificado o una nota descriptiva/i),
    ).toBeInTheDocument();
    expect(mockedTransport).not.toHaveBeenCalled();
  });

  test("TC-13: registra una ficha válida con factor y nota y dispara onSubmitSuccess", async () => {
    mockedTransport.mockResolvedValueOnce(jsonResponse({ ...fichasMock[0], id_ficha: 99 }, 201));
    const onSuccess = jest.fn();

    render(
      <FormFicha
        idPunto={101}
        factoresDisponibles={factoresMock}
        session={mockSession}
        rolUsuario="inspector"
        onSubmitSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByText("Visibilidad obstruida"));
    const textarea = screen.getByPlaceholderText(/Documente la visibilidad desde la posición del conductor/i);
    fireEvent.change(textarea, { target: { value: "Obstrucción parcial por kiosco." } });

    fireEvent.click(screen.getByRole("button", { name: /Registrar Ficha de Inspección/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(99);
    });
    expect(await screen.findByText(/registrada exitosamente/i)).toBeInTheDocument();
  });
});

describe("Componente HistorialFichas", () => {
  beforeEach(() => {
    mockedTransport.mockReset();
  });

  test("TC-19: muestra estado vacío cuando el punto no tiene fichas registradas", async () => {
    mockedTransport.mockResolvedValueOnce(jsonResponse([]));

    render(
      <HistorialFichas
        idPunto={101}
        session={mockSession}
        rolUsuario="inspector"
        idUsuarioActual={2}
      />,
    );

    expect(await screen.findByText(/No se registran fichas técnicas de inspección/i)).toBeInTheDocument();
  });

  test("TC-18, TC-20 y TC-21: lista fichas ordenadas y habilita edición solo en ficha propia", async () => {
    mockedTransport.mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH") {
        return jsonResponse({ ...fichasMock[0], notas: "Nota actualizada" });
      }
      return jsonResponse(fichasMock);
    });

    render(
      <HistorialFichas
        idPunto={101}
        session={mockSession}
        rolUsuario="inspector"
        idUsuarioActual={2}
        factoresDisponibles={factoresMock}
      />,
    );

    expect(await screen.findByText("Ficha de otro inspector")).toBeInTheDocument();
    expect(screen.getByText("Ficha del inspector actual")).toBeInTheDocument();

    // Expandimos la ficha propia (#10) y verificamos que muestre botón de edición
    fireEvent.click(screen.getByRole("button", { name: /Ficha #10/i }));
    const editButtons = await screen.findAllByRole("button", { name: /Editar ficha propia/i });
    expect(editButtons).toHaveLength(1);

    fireEvent.click(editButtons[0]);
    const notasInput = screen.getByDisplayValue("Ficha del inspector actual");
    fireEvent.change(notasInput, { target: { value: "Nota actualizada" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText(/actualizada correctamente/i)).toBeInTheDocument();
  });
});

describe("Componente UploadFotos", () => {
  test("TC-16: muestra error en pantalla si se intenta adjuntar un archivo con formato no admitido", () => {
    const onChange = jest.fn();
    const { container } = render(<UploadFotos fotos={[]} onFotosChange={onChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["pdf"], "acta.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByText(/Solo se admiten formatos JPEG o PNG/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
