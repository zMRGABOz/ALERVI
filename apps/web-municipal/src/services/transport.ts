import { env } from "../config/env";

export type ApiTransport = (url: URL, options: RequestInit) => Promise<Response>;

export const DEMO_TOKEN_PREFIX = "alervi-demo:";

export class DemoTokenError extends Error {
  constructor() {
    super(
      "La sesión de demostración solo es válida en modo mock. Inicia sesión nuevamente.",
    );
    this.name = "DemoTokenError";
  }
}

export const transport: ApiTransport = async (url, options) => {
  if (env.apiMode === "mock") {
    const { mockTransport } = await import("../mocks/transport");
    return mockTransport(url, options);
  }

  const authorization = new Headers(options.headers).get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (token?.startsWith(DEMO_TOKEN_PREFIX)) {
    throw new DemoTokenError();
  }

  return fetch(url, options);
};
