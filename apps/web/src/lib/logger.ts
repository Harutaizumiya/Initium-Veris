export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  scope: string;
  event?: string;
  message: string;
  details?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

type LogListener = (entries: LogEntry[]) => void;
type LogDetails = Record<string, unknown>;

const DEFAULT_MAX_ENTRIES = 200;
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "qr",
  "rawqr",
  "token",
]);

let entries: LogEntry[] | null = null;
const listeners = new Set<LogListener>();

function getEnvValue<K extends keyof ImportMetaEnv>(key: K) {
  return import.meta.env[key];
}

function parseBoolean(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

function getConfiguredLevel(): LogLevel {
  const level = getEnvValue("VITE_LOG_LEVEL")?.trim().toLowerCase();
  if (level === "debug" || level === "info" || level === "warn" || level === "error") {
    return level;
  }
  return "info";
}

function getMaxEntries() {
  const configuredMax = Number(getEnvValue("VITE_LOG_MAX_ENTRIES"));
  if (Number.isFinite(configuredMax) && configuredMax > 0) {
    return Math.floor(configuredMax);
  }
  return DEFAULT_MAX_ENTRIES;
}

function isLoggingEnabled() {
  const configured = parseBoolean(getEnvValue("VITE_LOG_ENABLED"));
  if (configured !== null) {
    return configured;
  }
  return import.meta.env.MODE === "debug";
}

function shouldRecord(level: LogLevel) {
  return isLoggingEnabled() && LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[getConfiguredLevel()];
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeError(error: unknown): LogEntry["error"] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return {
      name: "name" in error && typeof error.name === "string" ? error.name : undefined,
      message: error.message,
      stack: "stack" in error && typeof error.stack === "string" ? error.stack : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return undefined;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[MaxDepth]";
  }
  if (value instanceof Error) {
    return normalizeError(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeValue(item, depth + 1),
    ]),
  );
}

function loadEntries() {
  if (entries) {
    return entries;
  }

  entries = [];
  return entries;
}

function persistEntries(nextEntries: LogEntry[]) {
  entries = nextEntries;

  listeners.forEach((listener) => listener([...nextEntries]));
}

function appendEntry(entry: LogEntry) {
  const nextEntries = [...loadEntries(), entry].slice(-getMaxEntries());
  persistEntries(nextEntries);
}

function toLogEntry(level: LogLevel, scope: string, message: string, detailsOrError?: LogDetails | Error): LogEntry {
  const event =
    detailsOrError && !(detailsOrError instanceof Error) && typeof detailsOrError.event === "string"
      ? detailsOrError.event
      : undefined;
  const rawError =
    detailsOrError instanceof Error
      ? detailsOrError
      : detailsOrError && "error" in detailsOrError
        ? detailsOrError.error
        : undefined;
  const error = normalizeError(rawError);
  const sanitizedDetails =
    detailsOrError && !(detailsOrError instanceof Error)
      ? (sanitizeValue(detailsOrError) as Record<string, unknown>)
      : undefined;

  if (sanitizedDetails && "error" in sanitizedDetails) {
    delete sanitizedDetails.error;
  }

  return {
    id: createId(),
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    message,
    ...(sanitizedDetails && Object.keys(sanitizedDetails).length > 0 ? { details: sanitizedDetails } : {}),
    ...(error ? { error } : {}),
  };
}

function record(level: LogLevel, scope: string, message: string, detailsOrError?: LogDetails | Error) {
  if (!shouldRecord(level)) {
    return;
  }

  appendEntry(toLogEntry(level, scope, message, detailsOrError));
}

export const logger = {
  debug: (scope: string, message: string, details?: LogDetails) => record("debug", scope, message, details),
  info: (scope: string, message: string, details?: LogDetails) => record("info", scope, message, details),
  warn: (scope: string, message: string, details?: LogDetails) => record("warn", scope, message, details),
  error: (scope: string, message: string, detailsOrError?: LogDetails | Error) =>
    record("error", scope, message, detailsOrError),
};

export function getLogEntries() {
  return [...loadEntries()];
}

export function subscribeLogEntries(listener: LogListener) {
  listeners.add(listener);
  listener(getLogEntries());

  return () => {
    listeners.delete(listener);
  };
}

export function clearLogEntries() {
  persistEntries([]);
}
