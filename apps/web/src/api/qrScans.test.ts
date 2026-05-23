import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "./client";
import { createQrScan } from "./qrScans";

describe("createQrScan", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("posts the raw QR audit payload", async () => {
    setCsrfToken("csrf-token");
    const response = {
      auditId: "scan_001",
      batchCode: "B202605120001",
      productName: "鲜奶",
      status: "valid",
      message: "该批次仍在效期内",
      expireDate: "2026-06-01",
      remainingDays: 20,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: response }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createQrScan({
        qr: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
        source: "handheld",
        deviceId: "scanner-01",
        clientScanId: "client-scan-001",
        scannedAt: "2026-05-12T10:30:00.000Z",
      }),
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/qr-scans");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers["X-CSRFToken"]).toBe("csrf-token");
    expect(JSON.parse(options.body)).toEqual({
      qr: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
      source: "handheld",
      deviceId: "scanner-01",
      clientScanId: "client-scan-001",
      scannedAt: "2026-05-12T10:30:00.000Z",
    });
  });
});
