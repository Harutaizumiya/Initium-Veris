import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute, RouteAccessGuard } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { MainLayout } from "./components/layout/MainLayout";
import { appRoutes } from "./routes/appRoutes";

const LoginPage = lazy(() => import("./components/pages/LoginPage").then((module) => ({ default: module.LoginPage })));

function PageFallback() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-container-high border-t-primary" />
    </div>
  );
}

function LayoutWrapper() {
  return (
    <ErrorBoundary>
      <MainLayout>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </MainLayout>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route
            path="/login"
            element={
              <Suspense fallback={<PageFallback />}>
                <LoginPage />
              </Suspense>
            }
          />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<LayoutWrapper />}>
            {appRoutes.map((route) => {
              const Page = route.component;
              return (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RouteAccessGuard route={route}>
                    <Page />
                  </RouteAccessGuard>
                }
              />
              );
            })}
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
