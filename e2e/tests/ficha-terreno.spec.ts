import { expect, test } from "@playwright/test";

// PNG mínimo válido (1x1 px) para probar la sanitización EXIF en Canvas y adjunto de foto
const VALID_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("Fichas de terreno: sesión Inspector en demostración local", () => {
  test("opera de punta a punta desde Ranking hasta Terreno con evidencia fotográfica", async ({
    page,
  }) => {
    // 1. Consultar un ranking filtrado con la sesión local de Inspector.
    const rankingPath = "/ranking?anio=2024&limit=20&offset=3";
    const notas = "Inspección E2E Playwright: visibilidad reducida en cruce peatonal.";
    await page.goto(rankingPath);
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranking de prioridades/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: "Resultados comunales", exact: true }),
    ).toBeVisible();

    const firstRankingRow = page.getByRole("table").locator("tbody tr").first();
    await expect(firstRankingRow).toBeVisible();
    const nombrePunto = await firstRankingRow.getByRole("rowheader").innerText();
    await firstRankingRow.getByRole("button", {
      name: `Acciones de ${nombrePunto}`,
      exact: true,
    }).click();

    // 2. Abrir el historial del punto de esa fila, conservando el regreso.
    const fichasAction = page.getByRole("menuitem", {
      name: `Ver historial de fichas de ${nombrePunto}`,
      exact: true,
    });
    await expect(fichasAction).toHaveAttribute("href", /^\/terreno\?/);
    const fichasHref = await fichasAction.getAttribute("href");
    const idPunto = new URL(fichasHref!, page.url()).searchParams.get("punto");
    expect(idPunto).toMatch(/^[1-9]\d*$/);
    await fichasAction.click();

    await expect(page).toHaveURL((url) =>
      url.pathname === "/terreno" &&
      url.searchParams.get("punto") === idPunto &&
      url.searchParams.get("vista") === "historial" &&
      url.searchParams.get("volver") === rankingPath,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Ficha Técnica de Terreno/i }),
    ).toBeVisible();
    const contexto = page.getByRole("region", { name: "Contexto del punto de inspección", exact: true });
    const estadoPunto = contexto.getByRole("status").filter({ hasText: /^Punto #/ });
    await expect(contexto).toContainText(nombrePunto);
    await expect(estadoPunto).toHaveText(`Punto #${idPunto} · Fichas registradas: 0`);
    await expect(page.getByRole("button", { name: "Historial de fichas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("No se registran fichas técnicas de inspección para este punto crítico.", { exact: true })).toBeVisible();

    // 3. Registrar una inspección para el mismo ID y nombre del ranking.
    await page.getByRole("button", { name: "Nueva inspección", exact: true }).click();
    const formulario = page.getByRole("region", { name: "Registro de inspección", exact: true });
    await expect(
      formulario.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i }),
    ).toBeVisible();
    await expect(formulario).toContainText(`Punto Crítico #${idPunto} — ${nombrePunto}`);

    const factorBtn = formulario.getByRole("button", {
      name: /Falta de demarcación de cruce peatonal/i,
    });
    await factorBtn.click();
    await expect(factorBtn).toHaveAttribute("aria-pressed", "true");

    await formulario.getByRole("textbox", { name: "Observaciones Técnicas y Diagnóstico de Campo", exact: true }).fill(notas);
    await expect(formulario.getByText(`${notas.length}/500 caracteres`, { exact: true })).toBeVisible();

    // 4. Adjuntar una fotografía y esperar a que finalice su procesamiento.
    await formulario.getByTestId("input-upload-fotos").setInputFiles({
      name: "evidencia-cruce.png",
      mimeType: "image/png",
      buffer: Buffer.from(VALID_1X1_PNG_BASE64, "base64"),
    });

    await expect(formulario.getByText("Toma #1", { exact: true })).toBeVisible();
    await expect(formulario.getByText("evidencia-cruce.png", { exact: true })).toBeVisible();
    await expect(formulario.getByText(/Sin metadatos EXIF/)).toBeVisible();

    // 5. Consultar el registro creado y su fotografía en el historial cerrado inicialmente.
    await formulario
      .getByRole("button", { name: /Registrar Ficha de Inspección/i })
      .click();

    await expect(
      page.getByRole("heading", { level: 3, name: "Historial de Fichas (1)", exact: true }),
    ).toBeVisible();
    await expect(estadoPunto).toHaveText(`Punto #${idPunto} · Fichas registradas: 1`);
    await expect(page.getByRole("button", { name: "Historial de fichas", exact: true })).toHaveAttribute("aria-pressed", "true");
    const ficha = page.getByTestId(/^ficha-item-\d+$/).filter({ hasText: notas });
    await expect(ficha).toHaveCount(1);
    const cabeceraFicha = ficha.getByRole("button", { name: /^Ficha #\d+/ });
    await expect(cabeceraFicha).toHaveAttribute("aria-expanded", "false");
    await expect(ficha.getByRole("region")).toHaveCount(0);
    await cabeceraFicha.click();
    const detalleFicha = ficha.getByRole("region");
    await expect(detalleFicha).toContainText(notas);
    await expect(detalleFicha).toContainText("Falta de demarcación de cruce peatonal");
    await expect(detalleFicha.getByRole("link", { name: /^Fotografía #1 \(ID \d+\)$/ })).toBeVisible();
    await cabeceraFicha.click();
    await expect(cabeceraFicha).toHaveAttribute("aria-expanded", "false");
    await expect(ficha.getByRole("region")).toHaveCount(0);

    // 6. Regresar al ranking con el año, Top N y desplazamiento originales.
    const regresar = page.getByRole("link", { name: "Retomar ranking", exact: true });
    await expect(regresar).toHaveAttribute("href", rankingPath);
    await regresar.click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === rankingPath);
    await expect(page.getByRole("table").getByRole("rowheader", { name: nombrePunto, exact: true })).toBeVisible();
  });

  test("valida regla RB-10 al intentar enviar ficha sin factores ni notas", async ({
    page,
  }) => {
    await page.goto("/terreno");
    await expect(page.getByRole("heading", { name: "Selecciona un punto de trabajo", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i })).toHaveCount(0);

    // El acceso independiente requiere una selección explícita con el nuevo buscador.
    const buscador = page.getByRole("combobox", { name: "Buscar por intersección o ID", exact: true });
    await expect(buscador).toBeEnabled();
    await buscador.fill("prat martin");
    await expect(page.getByRole("option", { name: /Av\. Arturo Prat con San Martín.*Punto #2/ })).toBeVisible();
    await buscador.press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("punto") === "2" && url.searchParams.get("vista") === "historial");
    await expect(page.getByRole("heading", { level: 3, name: "Historial de Fichas (1)", exact: true })).toBeVisible();
    const contexto = page.getByRole("region", { name: "Contexto del punto de inspección", exact: true });
    const estadoPunto = contexto.getByRole("status").filter({ hasText: /^Punto #/ });
    await expect(estadoPunto).toHaveText("Punto #2 · Fichas registradas: 1");

    await page.getByRole("button", { name: "Nueva inspección", exact: true }).click();
    const formulario = page.getByRole("region", { name: "Registro de inspección", exact: true });
    await expect(
      formulario.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i }),
    ).toBeVisible();
    await expect(formulario).toContainText("Punto Crítico #2 — Av. Arturo Prat con San Martín");
    await expect(formulario.getByRole("textbox", { name: "Observaciones Técnicas y Diagnóstico de Campo", exact: true })).toHaveValue("");
    await expect(formulario.getByRole("button", { pressed: true })).toHaveCount(0);

    await formulario
      .getByRole("button", { name: /Registrar Ficha de Inspección/i })
      .click();

    const alertBox = formulario.getByRole("alert").filter({
      hasText: /al menos un factor de riesgo identificado o una nota descriptiva/i,
    });
    await expect(alertBox).toBeVisible();
    await expect(formulario).toBeVisible();

    // El envío rechazado y la cancelación no agregan fichas ni cambian de punto.
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("punto") === "2" && url.searchParams.get("vista") === "historial");
    await expect(page.getByRole("button", { name: "Historial de fichas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 3, name: "Historial de Fichas (1)", exact: true })).toBeVisible();
    await expect(estadoPunto).toHaveText("Punto #2 · Fichas registradas: 1");
    await expect(page.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i })).toHaveCount(0);
  });
});
