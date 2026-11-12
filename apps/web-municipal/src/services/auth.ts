import type { components } from "../types/api.generated";
import { apiRequest, type RequestOptions } from "./api";

export type LoginRequest = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];

export function login(
  credentials: LoginRequest,
  options: RequestOptions = {},
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: credentials,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}
