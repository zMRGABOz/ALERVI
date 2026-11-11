export type ApiMode = "mock" | "api-stub" | "api";

export type PublicEnv = Readonly<{
  apiMode: ApiMode;
  apiBaseUrl: string;
}>;

type PublicEnvInput = {
  NEXT_PUBLIC_API_MODE?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
};

export function parsePublicEnv(values: PublicEnvInput): PublicEnv {
  const apiMode = values.NEXT_PUBLIC_API_MODE ?? "mock";

  if (apiMode !== "mock" && apiMode !== "api-stub" && apiMode !== "api") {
    throw new Error(
      'Configuración inválida: NEXT_PUBLIC_API_MODE debe ser "mock", "api-stub" o "api".',
    );
  }

  let apiBaseUrl: URL;

  try {
    apiBaseUrl = new URL(
      values.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    );
  } catch {
    throw new Error(
      "Configuración inválida: NEXT_PUBLIC_API_BASE_URL debe ser una URL absoluta válida.",
    );
  }

  if (apiBaseUrl.protocol !== "http:" && apiBaseUrl.protocol !== "https:") {
    throw new Error(
      "Configuración inválida: NEXT_PUBLIC_API_BASE_URL debe usar HTTP o HTTPS.",
    );
  }

  if (apiBaseUrl.username || apiBaseUrl.password) {
    throw new Error(
      "Configuración inválida: NEXT_PUBLIC_API_BASE_URL no puede incluir usuario ni contraseña.",
    );
  }

  return Object.freeze({ apiMode, apiBaseUrl: apiBaseUrl.href });
}

export const env = parsePublicEnv({
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
