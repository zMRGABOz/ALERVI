import { expect, test } from "@playwright/test";

// PNG mínimo válido (1x1 px) para probar la sanitización EXIF en Canvas y adjunto de foto
const VALID_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("Flujo E2E Principal: Sesión Inspector -> Ver Ranking -> Crear Ficha con Foto", () => {
  test("opera de punta a punta desde Ranking hasta Terreno con evidencia fotográfica", async ({
    page,
  }) => {
    // 1. Login / Sesión municipal (modo demo local con perfil Inspector por defecto) y Ver Ranking
    await page.goto("/ranking");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranking de prioridades/i }),
    ).toBeVisible();

    // Verifica que cargue la tabla del ranking y permita seleccionar un punto
    await expect(
      page.getByRole("heading", { level: 2, name: /Top \d+ comunal/i }),
    ).toBeVisible();

    const firstRankingRow = page.locator("table tbody tr").first();
    await expect(firstRankingRow).toBeVisible();
    await firstRankingRow.click();

    // 2. Navegar al módulo de Terreno desde la barra lateral
    const terrenoLink = page.getByRole("link", { name: /Terreno|Fichas/i }).first();
    if (await terrenoLink.isVisible()) {
      await terrenoLink.click();
    } else {
      await page.goto("/terreno");
    }

    await expect(page).toHaveURL(/\/terreno/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Ficha Técnica de Terreno/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i }),
    ).toBeVisible();

    // 3. Seleccionar punto crítico, factor de riesgo y redactar observaciones
    await page.locator("#selectorPunto").selectOption("2");

    const factorBtn = page.getByRole("button", {
      name: /Falta de demarcación de cruce peatonal/i,
    });
    await factorBtn.click();
    await expect(factorBtn).toHaveAttribute("aria-pressed", "true");

    await page
      .locator("#notas")
      .fill("Inspección E2E Playwright: visibilidad reducida en cruce peatonal.");
    await expect(page.getByText(/\/500 caracteres/)).toBeVisible();

    // 4. Adjuntar fotografía válida y verificar sanitización EXIF en cliente
    await page.getByTestId("input-upload-fotos").setInputFiles({
      name: "evidencia-cruce.png",
      mimeType: "image/png",
      buffer: Buffer.from(VALID_1X1_PNG_BASE64, "base64"),
    });

    await expect(page.getByText("Toma #1")).toBeVisible();
    await expect(page.getByText(/evidencia-cruce\.png/)).toBeVisible();
    await expect(page.getByText(/Sin metadatos EXIF/)).toBeVisible();

    // 5. Registrar ficha y verificar transición automática al Historial de Fichas
    await page
      .getByRole("button", { name: /Registrar Ficha de Inspección/i })
      .click();

    await expect(
      page.getByRole("heading", { level: 3, name: /Historial de Fichas/i }),
    ).toBeVisible();
  });

  test("valida regla RB-10 al intentar enviar ficha sin factores ni notas", async ({
    page,
  }) => {
    await page.goto("/terreno");
    await expect(
      page.getByRole("heading", { level: 2, name: /Ficha Técnica de Inspección/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Registrar Ficha de Inspección/i })
      .click();

    const alertBox = page.getByRole("alert").filter({
      hasText: /factor de riesgo/i,
    });
    await expect(alertBox).toBeVisible();
  });
});
