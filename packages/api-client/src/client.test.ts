import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./types";
import { createApiClient } from "./client";

describe("createApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds requests with base URL, JSON body, cookie credentials and CSRF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });
    const client = createApiClient({
      baseUrl: "https://api.example.test/api/",
      fetchFn: fetchMock,
      getCsrfToken: () => "csrf-token",
    });

    await expect(client.requestJson("/products", { method: "POST", body: { product_name: "Milk" } })).resolves.toEqual({ ok: true });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/products");
    expect(options.credentials).toBe("include");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-CSRFToken"]).toBe("csrf-token");
    expect(JSON.parse(options.body)).toEqual({ product_name: "Milk" });
  });

  it("supports bearer auth headers without CSRF for mobile clients", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });
    const client = createApiClient({
      baseUrl: "https://api.example.test/api",
      credentials: "omit",
      csrf: false,
      fetchFn: fetchMock,
      getAuthHeaders: () => ({ Authorization: "Bearer mobile-token" }),
    });

    await client.requestJson("qr-scans", { method: "POST", body: { qr: "OB1|A|B" } });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/qr-scans");
    expect(options.credentials).toBe("omit");
    expect(options.headers.authorization).toBe("Bearer mobile-token");
    expect(options.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("reports authenticated 401 responses to the unauthorized handler", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 4011, message: "unauthenticated", data: null }),
    });
    const unauthorizedHandler = vi.fn();
    const client = createApiClient({ fetchFn: fetchMock });
    client.setUnauthorizedHandler(unauthorizedHandler);

    await expect(client.requestJson("/auth/me")).rejects.toMatchObject({
      status: 401,
      code: 4011,
      message: "unauthenticated",
    });
    await expect(client.requestJson("/auth/login", { auth: false })).rejects.toBeInstanceOf(ApiClientError);
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });
});
