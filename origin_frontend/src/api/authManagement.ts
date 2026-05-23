import { requestJson } from "./client";
import type { ApiListData } from "./types";

export interface PermissionDto {
  code: string;
  name: string;
  component: string;
  action: string;
  description: string;
}

export interface PermissionGroup {
  component: string;
  permissions: PermissionDto[];
}

export interface AuthRole {
  id: number;
  name: string;
  permissions: string[];
}

export interface AuthAdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: AuthRole[];
  direct_permissions: string[];
  effective_permissions: string[];
}

export interface RoleMutationInput {
  name: string;
  permission_codes: string[];
}

export interface UserCreateInput {
  username: string;
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  group_ids: number[];
  permission_codes: string[];
}

export type UserUpdateInput = Omit<UserCreateInput, "username" | "password">;

export async function listPermissions() {
  const data = await requestJson<ApiListData<PermissionGroup>>("/auth/permissions");
  return data.items;
}

export async function listRoles() {
  const data = await requestJson<ApiListData<AuthRole>>("/auth/roles");
  return data.items;
}

export async function createRole(input: RoleMutationInput) {
  return requestJson<AuthRole>("/auth/roles", {
    method: "POST",
    body: {
      name: input.name.trim(),
      permission_codes: input.permission_codes,
    },
  });
}

export async function updateRole(roleId: number, input: RoleMutationInput) {
  return requestJson<AuthRole>(`/auth/roles/${roleId}`, {
    method: "PATCH",
    body: {
      name: input.name.trim(),
      permission_codes: input.permission_codes,
    },
  });
}

export async function deleteRole(roleId: number) {
  return requestJson<{ id: number }>(`/auth/roles/${roleId}`, {
    method: "DELETE",
  });
}

export async function listUsers() {
  const data = await requestJson<ApiListData<AuthAdminUser>>("/auth/users");
  return data.items;
}

export async function createUser(input: UserCreateInput) {
  return requestJson<AuthAdminUser>("/auth/users", {
    method: "POST",
    body: {
      username: input.username.trim(),
      password: input.password,
      email: input.email.trim(),
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      is_active: input.is_active,
      is_staff: input.is_staff,
      group_ids: input.group_ids,
      permission_codes: input.permission_codes,
    },
  });
}

export async function updateUser(userId: number, input: UserUpdateInput) {
  return requestJson<AuthAdminUser>(`/auth/users/${userId}`, {
    method: "PATCH",
    body: {
      email: input.email.trim(),
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      is_active: input.is_active,
      is_staff: input.is_staff,
      group_ids: input.group_ids,
      permission_codes: input.permission_codes,
    },
  });
}

export async function resetUserPassword(userId: number, password: string) {
  return requestJson<{ id: number; password_reset: boolean }>(`/auth/users/${userId}/password`, {
    method: "POST",
    body: {
      password,
    },
  });
}
