import { logger } from "../lib/logger";
import { configureApiClient } from "@initium-veris/api-client";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api";

configureApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  credentials: "include",
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
