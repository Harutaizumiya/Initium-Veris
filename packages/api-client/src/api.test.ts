import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import { createQrScan } from "./qrScans";
import { createProduct, listProducts } from "./products";
import { approveStocktake, countStocktakeItem, createStocktake, updateStocktakeScope } from "./stocktakes";

describe("business API helpers", () => {
  it("keeps product request bodies in the backend snake_case contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: 1,
          barcode: "690",
          product_name: "Milk",
          shelf_life_days: 7,
          location: null,
          category: null,
          unit: "box",
          manufacturer: "Origin",
          created_at: "2026-05-01T00:00:00+08:00",
          updated_at: "2026-05-01T00:00:00+08:00",
        },
      }),
    });
    const client = createApiClient({ fetchFn: fetchMock, getCsrfToken: () => "csrf-token" });

    await createProduct(
      {
        barcode: " 690 ",
        product_name: " Milk ",
        shelf_life_days: 7,
        location: "",
        category: null,
        unit: " box ",
        manufacturer: " Origin ",
      },
      client,
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      barcode: "690",
      product_name: "Milk",
      shelf_life_days: 7,
      location: null,
      category: null,
      unit: "box",
      manufacturer: "Origin",
    });
  });

  it("maps product list DTOs to shared Product objects", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          items: [
            {
              id: 1,
              barcode: "690",
              product_name: "Milk",
              shelf_life_days: 7,
              location: "A-01",
              category: "Dairy",
              unit: "box",
              manufacturer: "Origin",
              created_at: "2026-05-01T00:00:00+08:00",
              updated_at: "2026-05-01T00:00:00+08:00",
            },
          ],
          pagination: { page: 1, size: 20, total: 1 },
        },
      }),
    });
    const client = createApiClient({ fetchFn: fetchMock });

    await expect(listProducts({ search: " Milk ", page: 1 }, client)).resolves.toMatchObject({
      items: [{ product_name: "Milk", location: "A-01" }],
      pagination: { total: 1 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/products?search=Milk&page=1");
  });

  it("submits QR scans with mobile-ready source and dedupe fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          auditId: "scan_001",
          batchCode: "B202605120001",
          productName: "鲜奶",
          status: "valid",
          message: "该批次仍在效期内",
          expireDate: "2026-06-01",
          remainingDays: 20,
          clientScanId: "client-scan-001",
        },
      }),
    });
    const client = createApiClient({ fetchFn: fetchMock, getCsrfToken: () => "csrf-token" });

    await createQrScan(
      {
        qr: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
        source: "mobile_camera",
        deviceId: "device-01",
        clientScanId: "client-scan-001",
      },
      client,
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      qr: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
      source: "mobile_camera",
      deviceId: "device-01",
      clientScanId: "client-scan-001",
      scannedAt: null,
    });
  });

  it("keeps stocktake workflow request bodies in the backend contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });
    const client = createApiClient({ fetchFn: fetchMock, getCsrfToken: () => "csrf-token" });

    await createStocktake({ task_type: "daily", scope_config: { categories: ["drink"] } }, client);
    await updateStocktakeScope(7, { add_batch_ids: [3], remove_batch_ids: [5] }, client);
    await countStocktakeItem(7, 9, { counted_quantity: " 8.00 ", remarks: " checked " }, client);
    await approveStocktake(7, { remarks: " approved " }, client);

    expect(fetchMock.mock.calls.map((call) => [call[0], JSON.parse(call[1].body)])).toEqual([
      [
        "http://localhost:8000/api/stocktakes",
        { task_type: "daily", scope_config: { categories: ["drink"] } },
      ],
      [
        "http://localhost:8000/api/stocktakes/7/scope",
        { add_batch_ids: [3], remove_batch_ids: [5] },
      ],
      [
        "http://localhost:8000/api/stocktakes/7/items/9/count",
        { counted_quantity: "8.00", status: "counted", remarks: "checked" },
      ],
      [
        "http://localhost:8000/api/stocktakes/7/approve",
        { remarks: "approved" },
      ],
    ]);
  });
});
