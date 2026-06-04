import { logger } from "../lib/logger";
import { configureApiClient } from "@initium-veris/api-client";
import { demoFetch } from "./demoStore";

const DEFAULT_API_BASE_URL = "https://demo.initium-veris.local/api";
const isTestMode = import.meta.env.MODE === "test";

let memoryAuthToken: string | null = null;

export function getStoredAuthToken() {
  return memoryAuthToken;
}

export function setStoredAuthToken(token: string, remember: boolean) {
  const trimmedToken = token.trim();
  memoryAuthToken = trimmedToken || null;
  void remember;
}

export function clearStoredAuthToken() {
  memoryAuthToken = null;
}

configureApiClient({
  baseUrl: DEFAULT_API_BASE_URL,
  credentials: "include",
  csrf: isTestMode,
  ...(isTestMode ? {} : { fetchFn: demoFetch }),
  getAuthHeaders: () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
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
