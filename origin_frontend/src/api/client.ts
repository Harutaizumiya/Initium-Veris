import { ApiClientError } from "./types";
import { logger } from "../lib/logger";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api";
let unauthorizedHandler: (() => void) | null = null;
let csrfToken: string | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildUrl(path: string) {
  const baseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
}

function readCookie(name: string) {
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

export function clearCsrfToken() {
  csrfToken = null;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token?.trim() || null;
}

export function getCsrfToken() {
  return csrfToken || readCookie("csrftoken");
}

async function ensureCsrfToken() {
  const existingToken = getCsrfToken();
  if (existingToken) {
    csrfToken = existingToken;
    return existingToken;
  }

  const response = await fetch(buildUrl("/auth/csrf"), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "request_failed";
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "number"
        ? payload.code
        : null;
    throw new ApiClientError(message, response.status, code);
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
      : readCookie("csrftoken");

  if (!token) {
    throw new ApiClientError("invalid_response", response.status);
  }

  csrfToken = token;
  return token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, body, headers, ...rest } = options;
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const method = rest.method ?? "GET";
  const csrfHeader = isStateChangingMethod(method) ? { "X-CSRFToken": await ensureCsrfToken() } : {};
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...rest,
      credentials: rest.credentials ?? "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeader,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    logger.error("api.client", "API request could not be sent", {
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
    }

    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "request_failed";
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "number"
        ? payload.code
        : null;
    logger.error("api.client", "API request failed", {
      event: "api_request_failed",
      path,
      method,
      status: response.status,
      code,
      durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
    });
    throw new ApiClientError(message, response.status, code);
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    logger.error("api.client", "API response shape is invalid", {
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
