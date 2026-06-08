import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLogEntries, getLogEntries, logger, subscribeLogEntries } from "./logger";

describe("logger", () => {
  afterEach(() => {
    clearLogEntries();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("records logs by default in debug mode", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "");
    vi.stubEnv("MODE", "debug");

    logger.info("test", "debug mode log");

    expect(getLogEntries()).toEqual([expect.objectContaining({ level: "info", message: "debug mode log" })]);
  });

  it("records logs when explicitly enabled through env", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "true");

    logger.info("test", "enabled log");

    expect(getLogEntries()).toHaveLength(1);
  });

  it("filters logs below the configured level", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "true");
    vi.stubEnv("VITE_LOG_LEVEL", "warn");

    logger.debug("test", "debug log");
    logger.info("test", "info log");
    logger.warn("test", "warn log");
    logger.error("test", "error log");

    expect(getLogEntries().map((entry) => entry.level)).toEqual(["warn", "error"]);
  });

  it("keeps only the most recent entries when the configured limit is exceeded", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "true");
    vi.stubEnv("VITE_LOG_MAX_ENTRIES", "2");

    logger.info("test", "first");
    logger.info("test", "second");
    logger.info("test", "third");

    expect(getLogEntries().map((entry) => entry.message)).toEqual(["second", "third"]);
  });

  it("redacts sensitive details", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "true");

    logger.info("test", "sensitive log", {
      token: "token-123",
      Authorization: "Bearer token-123",
      password: "secret",
      qr: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
      safe: "visible",
    });

    expect(getLogEntries()[0].details).toMatchObject({
      token: "[REDACTED]",
      Authorization: "[REDACTED]",
      password: "[REDACTED]",
      qr: "[REDACTED]",
      safe: "visible",
    });
  });

  it("notifies subscribers when logs are added and cleared", () => {
    vi.stubEnv("VITE_LOG_ENABLED", "true");
    const listener = vi.fn();
    const unsubscribe = subscribeLogEntries(listener);

    logger.info("test", "subscriber log");
    clearLogEntries();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[1][0]).toEqual([
      expect.objectContaining({ level: "info", message: "subscriber log" }),
    ]);
    expect(listener.mock.calls[2][0]).toEqual([]);
  });
});
