import { requestJson } from "./client";

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isStaff: boolean;
  isSuperuser: boolean;
  permissions: string[];
  displayName: string;
  roleLabel: string;
}

export interface AuthenticatedUserDto {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  permissions: string[];
}

interface LegacyLoginResponseDto {
  user: AuthenticatedUserDto;
}

export interface LoginCredentials {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  user: AuthenticatedUser;
}

export function toAuthenticatedUser(dto: AuthenticatedUserDto): AuthenticatedUser {
  const fullName = [dto.last_name, dto.first_name].filter(Boolean).join("");
  const displayName = fullName || dto.username;
  const roleLabel = dto.is_superuser ? "超级管理员" : dto.is_staff ? "Staff" : "普通用户";

  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    firstName: dto.first_name,
    lastName: dto.last_name,
    isStaff: dto.is_staff,
    isSuperuser: dto.is_superuser,
    permissions: dto.permissions,
    displayName,
    roleLabel,
  };
}

function isLegacyLoginResponse(data: AuthenticatedUserDto | LegacyLoginResponseDto): data is LegacyLoginResponseDto {
  return "user" in data && Boolean(data.user);
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const data = await requestJson<LegacyLoginResponseDto | AuthenticatedUserDto>("/auth/login", {
    auth: false,
    method: "POST",
    body: {
      username: credentials.username.trim(),
      password: credentials.password,
      remember_me: credentials.remember === true,
    },
  });
  const userDto = isLegacyLoginResponse(data) ? data.user : data;

  return {
    user: toAuthenticatedUser(userDto),
  };
}

export async function logout() {
  return requestJson<{ revoked: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  const data = await requestJson<AuthenticatedUserDto>("/auth/me");
  return toAuthenticatedUser(data);
}
