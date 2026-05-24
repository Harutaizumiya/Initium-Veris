import { logger } from "../lib/logger";
import { configureApiClient } from "@initium-veris/api-client";

const DEFAULT_API_BASE_URL = "http://47.98.36.24:8000/api";
const AUTH_TOKEN_KEY = "initium-veris.auth-token";

let memoryAuthToken: string | null = null;

function getStorage(kind: "localStorage" | "sessionStorage") {
  if (typeof window === "undefined") {
    return null;
  }

  return window[kind] ?? null;
}

export function getStoredAuthToken() {
  const sessionToken = getStorage("sessionStorage")?.getItem(AUTH_TOKEN_KEY);
  const localToken = getStorage("localStorage")?.getItem(AUTH_TOKEN_KEY);

  return sessionToken || localToken || memoryAuthToken;
}

export function setStoredAuthToken(token: string, remember: boolean) {
  const trimmedToken = token.trim();
  memoryAuthToken = trimmedToken || null;
  getStorage("localStorage")?.removeItem(AUTH_TOKEN_KEY);
  getStorage("sessionStorage")?.removeItem(AUTH_TOKEN_KEY);

  if (!trimmedToken) {
    return;
  }

  const storage = remember ? getStorage("localStorage") : getStorage("sessionStorage");
  storage?.setItem(AUTH_TOKEN_KEY, trimmedToken);
}

export function clearStoredAuthToken() {
  memoryAuthToken = null;
  getStorage("localStorage")?.removeItem(AUTH_TOKEN_KEY);
  getStorage("sessionStorage")?.removeItem(AUTH_TOKEN_KEY);
}

configureApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  credentials: "include",
  getAuthHeaders: () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  csrf: true,
  logger,
});

export {
  clearCsrfToken,
  configureApiClient,
  createApiClient,
  defaultApiClient,
  getCsrfToken,
  requestJson,
  setCsrfToken,
  setUnauthorizedHandler,
} from "@initium-veris/api-client";
export type { ApiClient, ApiClientConfig, ApiClientLogger, RequestOptions } from "@initium-veris/api-client";
