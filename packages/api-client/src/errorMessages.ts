import { ApiClientError } from "./types";

export interface FormatErrorMessageOptions {
  fallback?: string;
  apiClientMessage?: (error: ApiClientError) => string | null | undefined;
  apiClientMessages?: Record<string, string>;
  apiClientStatusMessages?: Record<number, string>;
  apiClientFallback?: (error: ApiClientError) => string;
  includeNativeErrorMessage?: boolean;
}

export function formatErrorMessage(error: unknown, options: FormatErrorMessageOptions = {}) {
  const fallback = options.fallback ?? "请求失败，请稍后重试。";

  if (error instanceof ApiClientError) {
    const resolvedApiClientMessage = options.apiClientMessage?.(error);
    if (resolvedApiClientMessage) {
      return resolvedApiClientMessage;
    }

    const statusMessage = options.apiClientStatusMessages?.[error.status];
    if (statusMessage) {
      return statusMessage;
    }

    const apiClientMessage = options.apiClientMessages?.[error.message];
    if (apiClientMessage) {
      return apiClientMessage;
    }

    return options.apiClientFallback ? options.apiClientFallback(error) : `请求失败：${error.message}`;
  }

  if (error instanceof Error && options.includeNativeErrorMessage !== false) {
    return error.message;
  }

  return fallback;
}
