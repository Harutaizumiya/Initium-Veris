import type { AuthenticatedUser } from "../api/auth";
import type { AppRoute } from "./appRoutes";

export function canAccessRoute(user: AuthenticatedUser | null, route: AppRoute) {
  if (!user) {
    return false;
  }

  if (user.isSuperuser) {
    return true;
  }

  if (route.requiresSuperuser) {
    return false;
  }

  const permissions = route.requiredPermissions ?? [];
  if (permissions.length === 0) {
    return true;
  }

  if (route.permissionMode === "all") {
    return permissions.every((permission) => user.permissions.includes(permission));
  }

  return permissions.some((permission) => user.permissions.includes(permission));
}

export function getFirstAccessibleRoute(user: AuthenticatedUser | null, routes: AppRoute[]) {
  return routes.find((route) => canAccessRoute(user, route)) ?? null;
}
