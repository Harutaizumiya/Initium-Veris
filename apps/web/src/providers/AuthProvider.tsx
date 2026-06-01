import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  clearCsrfToken,
  clearStoredAuthToken,
  formatErrorMessage,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  setStoredAuthToken,
  setUnauthorizedHandler,
  type AuthenticatedUser,
  type LoginCredentials,
} from "../api";
import { logger } from "../lib/logger";

interface AuthContextValue {
  hasAnyPermission: (codes: string[]) => boolean;
  hasPermission: (code: string) => boolean;
  initializationError: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  retryInitialize: () => Promise<void>;
  user: AuthenticatedUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_INITIALIZATION_ERROR_MESSAGE_OPTIONS = {
  fallback: "登录状态校验失败，请检查网络或稍后重试。",
  apiClientFallback: () => "登录状态校验失败，请检查网络或稍后重试。",
  includeNativeErrorMessage: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const clearLocalSession = useCallback(() => {
    logger.debug("auth", "Local session cleared", {
      event: "auth_session_cleared",
    });
    clearStoredAuthToken();
    clearCsrfToken();
    setUser(null);
    setInitializationError(null);
    queryClient.clear();
  }, [queryClient]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setInitializationError(null);

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        logger.warn("auth", "Stored session is unauthorized", {
          event: "auth_stored_session_unauthorized",
          status: error.status,
          code: error.code,
        });
        clearLocalSession();
      } else {
        logger.error("auth", "Failed to initialize authentication state", {
          event: "auth_initialization_failed",
          error,
        });
        setInitializationError(
          error instanceof ApiClientError && error.status === 401 ? null : formatErrorMessage(error, AUTH_INITIALIZATION_ERROR_MESSAGE_OPTIONS),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    return setUnauthorizedHandler(clearLocalSession);
  }, [clearLocalSession]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const result = await loginRequest(credentials);
        if (result.authToken) {
          setStoredAuthToken(result.authToken, credentials.remember === true);
        }
        setUser(result.user);
        setInitializationError(null);
        queryClient.clear();
        logger.info("auth", "User logged in", {
          event: "auth_login_succeeded",
          userId: result.user.id,
          role: result.user.roleLabel,
        });
        return result.user;
      } catch (error) {
        logger.warn("auth", "User login failed", {
          event: "auth_login_failed",
          username: credentials.username,
          error,
        });
        throw error;
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const hadUser = Boolean(user);
    if (hadUser) {
      await logoutRequest().catch(() => undefined);
    }

    clearLocalSession();
    logger.info("auth", "User logged out", {
      event: "auth_logout",
      hadUser,
      userId: user?.id ?? null,
    });
  }, [clearLocalSession, user]);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) {
        return false;
      }

      return user.isSuperuser || user.permissions.includes(code);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => {
      if (codes.length === 0) {
        return true;
      }

      return codes.some(hasPermission);
    },
    [hasPermission],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      hasAnyPermission,
      hasPermission,
      initializationError,
      isAuthenticated: Boolean(user),
      loading,
      login,
      logout,
      retryInitialize: initialize,
      user,
    }),
    [hasAnyPermission, hasPermission, initializationError, initialize, loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
