import { env, type ApiMode } from "./env";

export const DEMO_PROFILE_STORAGE_KEY = "alervi.demo-profile";

type DemoSessionContext = {
  nodeEnv: string | undefined;
  apiMode: ApiMode;
  hostname: string | null;
};

export function canUseDemoSession(context?: DemoSessionContext): boolean {
  const { nodeEnv, apiMode, hostname } = context ?? {
    nodeEnv: process.env.NODE_ENV,
    apiMode: env.apiMode,
    hostname: typeof window === "undefined" ? null : window.location.hostname,
  };

  if (nodeEnv !== "development" || apiMode !== "mock" || !hostname) return false;

  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;

  // URL normaliza las representaciones IPv6, incluyendo [::1] y 0:0:...:1.
  if (!host.includes(":")) return false;
  const address = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;

  try {
    return new URL(`http://[${address}]/`).hostname === "[::1]";
  } catch {
    return false;
  }
}
