import React from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import type { AppRoute } from "../../routes/appRoutes";
import { appRoutes } from "../../routes/appRoutes";
import { canAccessRoute, getFirstAccessibleRoute } from "../../routes/routeAccess";

function AuthGateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="flex items-center gap-3 rounded-3xl border border-surface-container/10 bg-surface-container-lowest px-6 py-5 text-sm font-semibold text-on-surface-variant ambient-shadow">
        <LoaderCircle size={18} className="animate-spin text-primary" />
        正在校验登录状态
      </div>
    </div>
  );
}

function AuthInitializationError({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest p-8 text-center ambient-shadow">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">登录状态校验失败</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">无法确认当前登录状态。可以重试，或退出后重新登录。</p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-container"
          >
            重试
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-surface-container px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
          >
            重新登录
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <AuthGateFallback />;
  }

  if (auth.initializationError) {
    return <AuthInitializationError onRetry={() => void auth.retryInitialize()} onLogout={() => void auth.logout()} />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function NoPermissionPage() {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6">
      <section className="max-w-md rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest p-8 text-center ambient-shadow">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant">
          <LockKeyhole size={24} />
        </div>
        <h1 className="mt-5 font-headline text-2xl font-extrabold tracking-tight text-on-surface">无权访问</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">当前账号没有访问该页面所需权限，请联系超级管理员调整角色或直接权限。</p>
      </section>
    </div>
  );
}

export function RouteAccessGuard({ route, children }: { route: AppRoute; children: React.ReactNode }) {
  const { user } = useAuth();
  const firstAccessibleRoute = getFirstAccessibleRoute(user, appRoutes);

  if (!canAccessRoute(user, route)) {
    if (route.path === "/" && firstAccessibleRoute) {
      return <Navigate to={firstAccessibleRoute.path} replace />;
    }

    return <NoPermissionPage />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;

  if (auth.loading) {
    return <AuthGateFallback />;
  }

  if (auth.isAuthenticated) {
    const firstAccessibleRoute = getFirstAccessibleRoute(auth.user, appRoutes);
    return <Navigate to={from?.pathname || firstAccessibleRoute?.path || "/settings/profile"} replace />;
  }

  return <Outlet />;
}
