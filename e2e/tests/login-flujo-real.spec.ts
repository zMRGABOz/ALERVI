import { expect, test } from "@playwright/test";

const VALID_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("Flujo E2E Real (API + Supabase): Login -> Ranking -> Terreno con Foto", () => {
  test.skip(
    process.env.NEXT_PUBLIC_API_MODE !== "api",
    "Solo se ejecuta cuando NEXT_PUBLIC_API_MODE=api con backend activo.",
  );

  test("autentica inspector en /login, consulta /ranking real y crea ficha con foto en /terreno", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const correo = process.env.E2E_INSPECTOR_EMAIL ?? "inspector@alervi.test";
    const password = process.env.E2E_INSPECTOR_PASSWORD ?? "Dev-2026-ALERVI";
    const notaUnica = `E2E Real ${Date.now()}: visibilidad reducida en cruce.`;

    // 1. Login real contra POST /api/v1/auth/login
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { level: 1, name: /Acceso municipal/i }),
    ).toBeVisible();

    await page.getByLabel("Correo institucional").fill(correo);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });

    // 2. Ir al Ranking real (puede tardar ~11s por _conteos_entorno en BD real)
    await page.goto("/ranking");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranking de prioridades/i }),
    ).toBeVisible();

    const firstRow = page.getByRole("table").locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    const nombrePunto = await firstRow.getByRole("rowheader").innerText();

    await firstRow
      .getByRole("button", { name: `Acciones de ${nombrePunto}`, exact: true })
      .click();
    await page
      .getByRole("menuitem", {
        name: `Ver historial de fichas de ${nombrePunto}`,
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(/\/terreno\?.*punto=/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Ficha Técnica de Terreno/i }),
    ).toBeVisible();

    // 3. Abrir formulario y crear ficha con foto sanitizada
    await page.getByRole("button", { name: "Nueva inspección", exact: true }).click();
    const formulario = page.getByRole("region", {
      name: "Registro de inspección",
      exact: true,
    });

    const factorBtn = formulario.locator("button[aria-pressed]").first();
    await factorBtn.click();
    await expect(factorBtn).toHaveAttribute("aria-pressed", "true");
    await formulario
      .getByRole("textbox", {
        name: "Observaciones Técnicas y Diagnóstico de Campo",
        exact: true,
      })
      .fill(notaUnica);

    await formulario.getByTestId("input-upload-fotos").setInputFiles({
      name: "evidencia-real.png",
      mimeType: "image/png",
      buffer: Buffer.from(VALID_1X1_PNG_BASE64, "base64"),
    });
    await expect(formulario.getByText("Toma #1", { exact: true })).toBeVisible();

    await formulario
      .getByRole("button", { name: /Registrar Ficha de Inspección/i })
      .click();

    // 4. Confirmar que la ficha creada aparece en el historial real
    const fichaCreada = page
      .getByTestId(/^ficha-item-\d+$/)
      .filter({ hasText: notaUnica });
    await expect(fichaCreada).toHaveCount(1, { timeout: 20_000 });
  });
});
