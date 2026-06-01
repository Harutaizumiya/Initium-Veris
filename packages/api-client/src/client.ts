import { ApiClientError } from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api";

export interface ApiClientLogger {
  error?: (scope: string, message: string, details?: Record<string, unknown>) => void;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
}

export interface ApiClientConfig {
  baseUrl?: string;
  credentials?: RequestCredentials;
  csrf?: boolean;
  csrfPath?: string;
  csrfHeaderName?: string;
  fetchFn?: typeof fetch;
  getAuthHeaders?: () => HeadersInit | Promise<HeadersInit>;
  getCsrfToken?: () => string | null | Promise<string | null>;
  setCsrfToken?: (token: string | null) => void;
  readCookie?: (name: string) => string | null;
  onUnauthorized?: () => void;
  logger?: ApiClientLogger;
}

export interface ApiClient {
  clearCsrfToken: () => void;
  configure: (config: ApiClientConfig) => void;
  getCsrfToken: () => string | null | Promise<string | null>;
  requestJson: <T>(path: string, options?: RequestOptions) => Promise<T>;
  setCsrfToken: (token: string | null) => void;
  setUnauthorizedHandler: (handler: (() => void) | null) => () => void;
}

export function isApiClient(value: unknown): value is ApiClient {
  return (
    value !== null &&
    typeof value === "object" &&
    "requestJson" in value &&
    typeof (value as { requestJson?: unknown }).requestJson === "function"
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function readBrowserCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function isStateChangingMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());
}

function headersToRecord(headers: HeadersInit | undefined) {
  const output: Record<string, string> = {};

  if (!headers) {
    return output;
  }

  new Headers(headers).forEach((value, key) => {
    output[key] = value;
  });

  return output;
}

function getPayloadErrorMessage(payload: unknown) {
  return payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
    ? payload.message
    : "request_failed";
}

function getErrorCode(payload: unknown) {
  return payload && typeof payload === "object" && "code" in payload && typeof payload.code === "number" ? payload.code : null;
}

export function createApiClient(initialConfig: ApiClientConfig = {}): ApiClient {
  let config: ApiClientConfig = {
    baseUrl: DEFAULT_API_BASE_URL,
    credentials: "include",
    csrf: true,
    csrfPath: "/auth/csrf",
    csrfHeaderName: "X-CSRFToken",
    readCookie: readBrowserCookie,
    ...initialConfig,
  };
  let unauthorizedHandler: (() => void) | null = null;
  let csrfToken: string | null = null;

  function buildUrl(path: string) {
    return `${trimTrailingSlash(config.baseUrl || DEFAULT_API_BASE_URL)}${normalizePath(path)}`;
  }

  function setCsrfToken(token: string | null) {
    csrfToken = token?.trim() || null;
    config.setCsrfToken?.(csrfToken);
  }

  function clearCsrfToken() {
    setCsrfToken(null);
  }

  async function getCsrfToken() {
    const externalToken = await config.getCsrfToken?.();
    return csrfToken || externalToken || config.readCookie?.("csrftoken") || null;
  }

  async function ensureCsrfToken() {
    const existingToken = await getCsrfToken();
    if (existingToken) {
      setCsrfToken(existingToken);
      return existingToken;
    }

    const fetchFn = config.fetchFn ?? fetch;
    const response = await fetchFn(buildUrl(config.csrfPath || "/auth/csrf"), {
      credentials: config.credentials,
      headers: {
        "Content-Type": "application/json",
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiClientError(getPayloadErrorMessage(payload), response.status, getErrorCode(payload));
    }

    const token =
      payload &&
      typeof payload === "object" &&
      "data" in payload &&
      payload.data &&
      typeof payload.data === "object" &&
      "csrf_token" in payload.data &&
      typeof payload.data.csrf_token === "string"
        ? payload.data.csrf_token
        : config.readCookie?.("csrftoken");

    if (!token) {
      throw new ApiClientError("invalid_response", response.status);
    }

    setCsrfToken(token);
    return token;
  }

  function setUnauthorizedHandler(handler: (() => void) | null) {
    unauthorizedHandler = handler;

    return () => {
      if (unauthorizedHandler === handler) {
        unauthorizedHandler = null;
      }
    };
  }

  async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, body, headers, ...rest } = options;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const method = rest.method ?? "GET";
    const csrfHeader =
      config.csrf !== false && isStateChangingMethod(method) ? { [config.csrfHeaderName || "X-CSRFToken"]: await ensureCsrfToken() } : {};
    const authHeaders = auth ? headersToRecord(await config.getAuthHeaders?.()) : {};
    const fetchFn = config.fetchFn ?? fetch;
    let response: Response;

    try {
      response = await fetchFn(buildUrl(path), {
        ...rest,
        credentials: rest.credentials ?? config.credentials,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...csrfHeader,
          ...headersToRecord(headers),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      config.logger?.error?.("api.client", "API request could not be sent", {
        event: "api_request_network_error",
        path,
        method,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
        error,
      });
      throw error;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 && auth) {
        unauthorizedHandler?.();
        config.onUnauthorized?.();
      }

      const code = getErrorCode(payload);
      config.logger?.error?.("api.client", "API request failed", {
        event: "api_request_failed",
        path,
        method,
        status: response.status,
        code,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      });
      throw new ApiClientError(getPayloadErrorMessage(payload), response.status, code);
    }

    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      config.logger?.error?.("api.client", "API response shape is invalid", {
        event: "api_invalid_response",
        path,
        method,
        status: response.status,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      });
      throw new ApiClientError("invalid_response", response.status);
    }

    return payload.data as T;
  }

  return {
    clearCsrfToken,
    configure: (nextConfig) => {
      config = { ...config, ...nextConfig };
    },
    getCsrfToken,
    requestJson,
    setCsrfToken,
    setUnauthorizedHandler,
  };
}

export const defaultApiClient = createApiClient();

export function configureApiClient(config: ApiClientConfig) {
  defaultApiClient.configure(config);
}

export const clearCsrfToken = defaultApiClient.clearCsrfToken;
export const getCsrfToken = defaultApiClient.getCsrfToken;
export const requestJson = defaultApiClient.requestJson;
export const setCsrfToken = defaultApiClient.setCsrfToken;
export const setUnauthorizedHandler = defaultApiClient.setUnauthorizedHandler;
