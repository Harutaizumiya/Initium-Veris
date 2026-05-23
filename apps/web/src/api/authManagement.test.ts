import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "./client";
import { createRole, createUser, listPermissions, listRoles, listUsers, resetUserPassword, updateRole, updateUser } from "./authManagement";

describe("auth management api", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("loads permissions, roles and users with cookie credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { items: [{ component: "products", permissions: [] }], pagination: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { items: [{ id: 1, name: "operator", permissions: ["products_read"] }], pagination: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            items: [
              {
                id: 2,
                username: "worker",
                email: "",
                first_name: "",
                last_name: "",
                is_active: true,
                is_staff: false,
                is_superuser: false,
                groups: [],
                direct_permissions: [],
                effective_permissions: ["products_read"],
              },
            ],
            pagination: null,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listPermissions()).resolves.toEqual([{ component: "products", permissions: [] }]);
    await expect(listRoles()).resolves.toEqual([{ id: 1, name: "operator", permissions: ["products_read"] }]);
    await expect(listUsers()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("sends snake_case request bodies for role and user mutations", async () => {
    setCsrfToken("csrf-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 1, name: "operator", permissions: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createRole({ name: " operator ", permission_codes: ["products_read"] });
    await updateRole(1, { name: "manager", permission_codes: ["analytics_read"] });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "operator", permission_codes: ["products_read"] });
    expect(fetchMock.mock.calls[0][1].headers["X-CSRFToken"]).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: "manager", permission_codes: ["analytics_read"] });
  });

  it("sends user create, update and password reset payloads", async () => {
    setCsrfToken("csrf-token");
    const adminUser = {
      id: 2,
      username: "worker",
      email: "",
      first_name: "",
      last_name: "",
      is_active: true,
      is_staff: false,
      is_superuser: false,
      groups: [],
      direct_permissions: [],
      effective_permissions: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: adminUser }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: adminUser }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 2, password_reset: true } }) });
    vi.stubGlobal("fetch", fetchMock);

    await createUser({
      username: " worker ",
      password: "secret",
      email: " worker@example.com ",
      first_name: "Origin",
      last_name: "User",
      is_active: true,
      is_staff: false,
      group_ids: [1],
      permission_codes: ["qr_scans_create"],
    });
    await updateUser(2, {
      email: "",
      first_name: "",
      last_name: "",
      is_active: false,
      is_staff: true,
      group_ids: [],
      permission_codes: [],
    });
    await resetUserPassword(2, "new-password");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: "worker",
      password: "secret",
      email: "worker@example.com",
      first_name: "Origin",
      last_name: "User",
      is_active: true,
      is_staff: false,
      group_ids: [1],
      permission_codes: ["qr_scans_create"],
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ is_active: false, is_staff: true });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ password: "new-password" });
  });
});
