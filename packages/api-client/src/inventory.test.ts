import { describe, expect, it, vi } from "vitest";
import { createClientScanId } from "./qrScans";
import { getShelfLifeMetricsFromDates, parseQuantity } from "./inventory";

describe("shared inventory utilities", () => {
  it("parses numeric quantity strings defensively", () => {
    expect(parseQuantity("8.50")).toBe(8.5);
    expect(parseQuantity("bad-value")).toBe(0);
  });

  it("calculates shelf-life metrics from manufacture and expiry dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T00:00:00+08:00"));

    expect(getShelfLifeMetricsFromDates("2026-05-12", "2026-05-01")).toMatchObject({
      remainingDays: 3,
      health: "warning",
    });

    vi.useRealTimers();
  });

  it("generates a scan id fallback when randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {});

    expect(createClientScanId()).toMatch(/^scan-\d+-[a-z0-9]+$/);

    vi.stubGlobal("crypto", originalCrypto);
  });
});
