import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "./client";
import { getCurrentUser, login, logout } from "./auth";

describe("auth api", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("logs in with username and password using cookie credentials and csrf", async () => {
    setCsrfToken("csrf-token");
    const response = {
      id: 7,
      username: "manager",
      email: "manager@example.com",
      first_name: "三",
      last_name: "张",
      is_staff: true,
      is_superuser: true,
      permissions: ["products_read"],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: response }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(login({ username: " manager ", password: "secret" })).resolves.toEqual({
      user: {
        id: 7,
        username: "manager",
        email: "manager@example.com",
        firstName: "三",
        lastName: "张",
        isStaff: true,
        isSuperuser: true,
        permissions: ["products_read"],
        displayName: "张三",
        roleLabel: "超级管理员",
      },
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/auth/login");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.credentials).toBe("include");
    expect(options.headers["X-CSRFToken"]).toBe("csrf-token");
    expect(JSON.parse(options.body)).toEqual({ username: "manager", password: "secret", remember_me: false });
  });

  it("loads the current user with cookie credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 8,
          username: "operator",
          email: "",
          first_name: "",
          last_name: "",
          is_staff: false,
          is_superuser: false,
          permissions: ["qr_scans_create"],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).resolves.toEqual({
      id: 8,
      username: "operator",
      email: "",
      firstName: "",
      lastName: "",
      isStaff: false,
      isSuperuser: false,
      permissions: ["qr_scans_create"],
      displayName: "operator",
      roleLabel: "普通用户",
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("logs out with cookie credentials and csrf", async () => {
    setCsrfToken("csrf-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { revoked: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).resolves.toEqual({ revoked: true });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/auth/logout");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.headers["X-CSRFToken"]).toBe("csrf-token");
  });
});
