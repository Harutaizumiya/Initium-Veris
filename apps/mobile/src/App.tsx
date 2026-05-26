import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import {
  BarChart3,
  Boxes,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  clearCsrfToken,
  configureApiClient,
  createBatch,
  createBatchOperation,
  createProduct,
  createQrScan,
  createRole,
  createUser,
  deleteProduct,
  deleteRole,
  getAnalyticsSummary,
  getCurrentUser,
  getDashboardData,
  listBatches,
  listBatchOperations,
  listPermissions,
  listProducts,
  listRoles,
  listUsers,
  logout as logoutRequest,
  parseQuantity,
  queryKeys,
  resetUserPassword,
  revertBatchOperation,
  setUnauthorizedHandler,
  toAuthenticatedUser,
  updateProduct,
  updateRole,
  updateUser,
  type AnalyticsRange,
  type AuthenticatedUserDto,
  type AuthAdminUser,
  type AuthenticatedUser,
  type AuthRole,
  type BatchDto,
  type BatchOperationDto,
  type BatchOperationType,
  type PermissionGroup,
  type Product,
} from "@initium-veris/api-client";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const API_BASE_URL =
  process?.env?.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8000/api" : "http://localhost:8000/api");

let mobileAuthToken: string | null = null;
const mobileCookies = new Map<string, string>();

interface MobileLoginResponse extends AuthenticatedUserDto {
  auth_token: string;
  expires_in: number;
}

function getPayloadMessage(payload: unknown) {
  return payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" ? payload.message : "request_failed";
}

function getPayloadCode(payload: unknown) {
  return payload && typeof payload === "object" && "code" in payload && typeof payload.code === "number" ? payload.code : null;
}

function getPayloadData<T>(payload: unknown) {
  return payload && typeof payload === "object" && "data" in payload ? (payload.data as T) : null;
}

async function mobileLoginRequest(username: string, password: string, remember: boolean) {
  const response = await fetch(`${API_BASE_URL}/auth/mobile-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username.trim(),
      password,
      remember_me: remember,
    }),
  });
  const payload = await response.json().catch(() => null);
  const data = getPayloadData<MobileLoginResponse>(payload);

  if (!response.ok) {
    throw new ApiClientError(getPayloadMessage(payload), response.status, getPayloadCode(payload));
  }

  if (!data?.auth_token) {
    throw new ApiClientError("invalid_response", response.status);
  }

  mobileAuthToken = data.auth_token;
  return { user: toAuthenticatedUser(data) };
}

function splitSetCookieHeader(value: string) {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((item) => item.trim()).filter(Boolean);
}

function storeResponseCookies(response: Response) {
  const rawSetCookie = response.headers.get("set-cookie");
  if (!rawSetCookie) {
    return;
  }

  for (const cookie of splitSetCookieHeader(rawSetCookie)) {
    const [nameValue, ...attributes] = cookie.split(";");
    if (!nameValue) {
      continue;
    }

    const separatorIndex = nameValue.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = nameValue.slice(0, separatorIndex).trim();
    const value = nameValue.slice(separatorIndex + 1).trim();
    const expiresImmediately = attributes.some((attribute) => attribute.trim().toLowerCase() === "max-age=0");

    if (!value || expiresImmediately) {
      mobileCookies.delete(name);
    } else {
      mobileCookies.set(name, value);
    }
  }
}

function getMobileCookieHeader() {
  return Array.from(mobileCookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function mobileFetch(input: RequestInfo | URL, init?: RequestInit) {
  const cookieHeader = getMobileCookieHeader();
  const headers = new Headers(init?.headers);
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const response = await fetch(input, { ...init, headers });
  storeResponseCookies(response);
  return response;
}

configureApiClient({
  baseUrl: API_BASE_URL,
  csrf: false,
  credentials: "include",
  fetchFn: mobileFetch,
  getAuthHeaders: () => {
    const headers: Record<string, string> = {};
    if (mobileAuthToken) {
      headers.Authorization = `Bearer ${mobileAuthToken}`;
    }
    return headers;
  },
  readCookie: (name) => mobileCookies.get(name) ?? null,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

type PrimaryTabKey = "dashboard" | "inventory" | "profile";
type SecondaryRouteKey = "overview" | "analytics" | "products" | "batches" | "loss" | "qr" | SettingsTab;
type SettingsTab = "profile" | "users" | "roles" | "permissions";
type ToastType = "success" | "warning" | "error";

interface ToastState {
  type: ToastType;
  title: string;
  message?: string;
}

interface AuthContextValue {
  hasPermission: (code: string) => boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
  user: AuthenticatedUser | null;
}

interface SecondaryRouteConfig {
  key: SecondaryRouteKey;
  label: string;
  permission?: string;
  superuserOnly?: boolean;
}

interface PrimaryTabConfig {
  key: PrimaryTabKey;
  label: string;
  icon: LucideIcon;
  routes: SecondaryRouteConfig[];
}

const primaryTabs: PrimaryTabConfig[] = [
  {
    key: "dashboard",
    label: "仪表盘",
    icon: LayoutDashboard,
    routes: [
      { key: "overview", label: "总览", permission: "dashboard_read" },
      { key: "analytics", label: "分析", permission: "analytics_read" },
    ],
  },
  {
    key: "inventory",
    label: "库存管理",
    icon: Package,
    routes: [
      { key: "products", label: "货物", permission: "products_read" },
      { key: "batches", label: "库存", permission: "batches_read" },
      { key: "loss", label: "报损", permission: "batch_operations_loss" },
      { key: "qr", label: "扫码", permission: "qr_scans_create" },
    ],
  },
  {
    key: "profile",
    label: "个人",
    icon: UserRound,
    routes: [
      { key: "profile", label: "账号" },
      { key: "users", label: "用户", superuserOnly: true },
      { key: "roles", label: "角色", superuserOnly: true },
      { key: "permissions", label: "权限", superuserOnly: true },
    ],
  },
];
const fallbackPrimaryTab = primaryTabs[2]!;

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    mobileAuthToken = null;
    mobileCookies.clear();
    clearCsrfToken();
    setUser(null);
    client.clear();
  }, [client]);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await getCurrentUser());
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSession();
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => setUnauthorizedHandler(clearSession), [clearSession]);

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      const result = await mobileLoginRequest(username, password, remember);
      setUser(result.user);
      client.clear();
    },
    [client],
  );

  const logout = useCallback(async () => {
    const hadUser = Boolean(user);
    if (hadUser) {
      await logoutRequest().catch(() => undefined);
    }
    clearSession();
  }, [clearSession, user]);

  const hasPermission = useCallback(
    (code: string) => Boolean(user?.isSuperuser || user?.permissions.includes(code)),
    [user],
  );

  const value = useMemo(
    () => ({
      hasPermission,
      isAuthenticated: Boolean(user),
      loading,
      login,
      logout,
      retry: initialize,
      user,
    }),
    [hasPermission, initialize, loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function canAccessRoute(route: SecondaryRouteConfig, auth: AuthContextValue) {
  if (route.superuserOnly && !auth.user?.isSuperuser) {
    return false;
  }

  return !route.permission || auth.hasPermission(route.permission);
}

function defaultSecondaryState(): Record<PrimaryTabKey, SecondaryRouteKey> {
  return {
    dashboard: "overview",
    inventory: "products",
    profile: "profile",
  };
}

function AppShell() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<PrimaryTabKey>("dashboard");
  const [activeSecondaryByTab, setActiveSecondaryByTab] = useState(defaultSecondaryState);
  const [toast, setToast] = useState<ToastState | null>(null);

  const visibleTabs = useMemo(
    () => primaryTabs.filter((tab) => tab.key === "profile" || tab.routes.some((route) => canAccessRoute(route, auth))),
    [auth],
  );
  const activeTabConfig = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0] ?? fallbackPrimaryTab;
  const visibleSecondaryRoutes = activeTabConfig.routes.filter((route) => canAccessRoute(route, auth));
  const activeSecondary = activeSecondaryByTab[activeTabConfig.key];
  const activeSecondaryRoute = visibleSecondaryRoutes.find((route) => route.key === activeSecondary) ?? visibleSecondaryRoutes[0] ?? activeTabConfig.routes[0]!;

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "profile");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (activeSecondaryRoute && activeSecondaryRoute.key !== activeSecondary) {
      setActiveSecondaryByTab((current) => ({ ...current, [activeTabConfig.key]: activeSecondaryRoute.key }));
    }
  }, [activeSecondary, activeSecondaryRoute, activeTabConfig.key]);

  const setActiveSecondary = useCallback(
    (route: SecondaryRouteKey) => {
      setActiveSecondaryByTab((current) => ({ ...current, [activeTabConfig.key]: route }));
    },
    [activeTabConfig.key],
  );

  if (auth.loading) {
    return <LoadingScreen label="正在校验登录状态" />;
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <Header primary={activeTabConfig} secondary={activeSecondaryRoute} />
        <View style={styles.content}>
          {activeTabConfig.key !== "profile" ? (
            <SecondaryMenu routes={visibleSecondaryRoutes} activeRoute={activeSecondaryRoute.key} onChange={setActiveSecondary} />
          ) : null}
          {activeSecondaryRoute.key === "overview" ? <DashboardScreen /> : null}
          {activeSecondaryRoute.key === "analytics" ? <AnalyticsScreen /> : null}
          {activeSecondaryRoute.key === "products" ? <ProductsScreen onToast={setToast} /> : null}
          {activeSecondaryRoute.key === "batches" ? <InventoryScreen onToast={setToast} /> : null}
          {activeSecondaryRoute.key === "loss" ? <LossScreen onToast={setToast} /> : null}
          {activeSecondaryRoute.key === "qr" ? <QrScanScreen onToast={setToast} /> : null}
          {["profile", "users", "roles", "permissions"].includes(activeSecondaryRoute.key) ? (
            <SettingsScreen activeTab={activeSecondaryRoute.key as SettingsTab} onTabChange={(tab) => setActiveSecondary(tab)} onToast={setToast} />
          ) : null}
        </View>
        <BottomNav tabs={visibleTabs} activeTab={activeTabConfig.key} onChange={setActiveTab} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centerScreen}>
        <ActivityIndicator color={tokens.primary} size="large" />
        <Text style={styles.mutedText}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError("请输入用户名和密码。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password, remember);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "登录失败，请检查账号密码或后端服务。"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.loginScreen}>
        <View style={styles.brandMark}>
          <Package color={tokens.primary} size={30} strokeWidth={2.4} />
        </View>
        <Text style={styles.loginTitle}>Initium Veris</Text>
        <Text style={styles.loginSubtitle}>食品库存移动工作台</Text>
        <View style={styles.card}>
          <TextField label="用户名" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextField label="密码" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={styles.switchRow}>
            <Text style={styles.bodyText}>保持登录</Text>
            <Switch value={remember} onValueChange={setRemember} trackColor={{ true: tokens.primary }} />
          </View>
          {error ? <InlineAlert type="error" message={error} /> : null}
          <PrimaryButton label="登录" icon={UserRound} loading={submitting} onPress={submit} />
          <Text style={styles.helpText}>API: {API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ primary, secondary }: { primary: PrimaryTabConfig; secondary?: SecondaryRouteConfig }) {
  const { logout, user } = useAuth();
  const Icon = primary.icon;
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <View style={styles.headerIcon}>
          <Icon color={tokens.primary} size={20} />
        </View>
        <View>
          <Text style={styles.headerTitle}>{primary.label}</Text>
          <Text style={styles.headerSubtitle}>{secondary?.label ?? "工作台"} · {user?.displayName} · {user?.roleLabel}</Text>
        </View>
      </View>
      <Pressable style={styles.iconButton} onPress={() => void logout()}>
        <LogOut color={tokens.onSurfaceVariant} size={19} />
      </Pressable>
    </View>
  );
}

function SecondaryMenu({
  activeRoute,
  onChange,
  routes,
}: {
  activeRoute: SecondaryRouteKey;
  onChange: (route: SecondaryRouteKey) => void;
  routes: SecondaryRouteConfig[];
}) {
  return (
    <View style={styles.secondaryNav}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryNavContent}>
        {routes.map((route) => {
          const active = route.key === activeRoute;
          return (
            <Pressable key={route.key} style={[styles.secondaryNavItem, active && styles.secondaryNavItemActive]} onPress={() => onChange(route.key)}>
              <Text style={[styles.secondaryNavLabel, active && styles.secondaryNavLabelActive]}>{route.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function BottomNav({
  activeTab,
  onChange,
  tabs,
}: {
  activeTab: PrimaryTabKey;
  onChange: (tab: PrimaryTabKey) => void;
  tabs: PrimaryTabConfig[];
}) {
  return (
    <View style={styles.bottomNav}>
      <View style={styles.bottomNavContent}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <Pressable key={tab.key} style={[styles.navItem, active && styles.navItemActive]} onPress={() => onChange(tab.key)}>
              <Icon color={active ? tokens.primary : tokens.onSurfaceVariant} size={18} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DashboardScreen() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: getDashboardData,
  });

  return (
    <RefreshableScreen refreshing={dashboardQuery.isRefetching} onRefresh={dashboardQuery.refetch}>
      <PageIntro title="库存总览" description="当前在库、临期、过期和健康率直接来自后端看板接口。" />
      {dashboardQuery.isLoading ? <LoadingCard label="正在加载总览" /> : null}
      {dashboardQuery.error ? <InlineAlert type="error" message={getErrorMessage(dashboardQuery.error)} /> : null}
      {dashboardQuery.data ? (
        <>
          <View style={styles.statGrid}>
            {dashboardQuery.data.stats.map((stat) => (
              <MetricCard key={stat.id} label={stat.title} value={stat.value} hint={stat.trend ?? ""} />
            ))}
          </View>
          <Section title="高风险批次" subtitle={`最后更新 ${dashboardQuery.data.lastUpdatedAt}`}>
            {dashboardQuery.data.urgentItems.length ? (
              dashboardQuery.data.urgentItems.map((item) => (
                <ListCard key={item.id} title={item.name} subtitle={`${item.batchId} · ${item.location}`} right={`${item.daysLeft} 天`} tone={item.status} />
              ))
            ) : (
              <EmptyState title="暂无高风险批次" />
            )}
          </Section>
          <Section title="品类分布">
            {dashboardQuery.data.categories.length ? (
              dashboardQuery.data.categories.map((category) => (
                <ProgressRow key={category.name} label={category.name} value={category.percentage} />
              ))
            ) : (
              <EmptyState title="暂无品类数据" />
            )}
          </Section>
          <Section title="30 天到期趋势">
            <View style={styles.chartBars}>
              {dashboardQuery.data.trendData.slice(0, 14).map((point) => (
                <View key={point.name} style={styles.chartBarItem}>
                  <View style={[styles.chartBar, { height: Math.max(8, point.value * 8) }, point.type === "critical" && styles.chartBarCritical]} />
                  <Text style={styles.chartLabel}>{point.name}</Text>
                </View>
              ))}
            </View>
          </Section>
        </>
      ) : null}
    </RefreshableScreen>
  );
}

function ProductsScreen({ onToast }: { onToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list({ page: 1, size: 100, search }),
    queryFn: () => listProducts({ page: 1, size: 100, search }),
  });

  const products = productsQuery.data?.items ?? [];

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
  };

  const removeProduct = (product: Product) => {
    Alert.alert("删除货物", `确认删除 ${product.product_name} 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            await reload();
            onToast({ type: "success", title: "货物已删除" });
          } catch (error) {
            onToast({ type: "error", title: "删除失败", message: getErrorMessage(error) });
          }
        },
      },
    ]);
  };

  return (
    <RefreshableScreen refreshing={productsQuery.isRefetching} onRefresh={productsQuery.refetch}>
      <PageIntro title="货物管理" description="支持查询、新增、编辑和删除货物。" />
      <SearchBox value={search} onChangeText={setSearch} placeholder="搜索货物名称、条码或厂商" />
      {hasPermission("products_create") ? (
        <PrimaryButton
          label="新增货物"
          icon={Plus}
          onPress={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
      ) : null}
      {productsQuery.isLoading ? <LoadingCard label="正在加载货物" /> : null}
      {productsQuery.error ? <InlineAlert type="error" message={getErrorMessage(productsQuery.error)} /> : null}
      {products.map((product) => (
        <InfoCard key={product.id}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.cardTitle}>{product.product_name}</Text>
              <Text style={styles.cardSubtitle}>{product.barcode}</Text>
            </View>
            <StatusPill label={`${product.shelf_life_days} 天`} />
          </View>
          <View style={styles.metaGrid}>
            <Meta label="厂商" value={product.manufacturer} />
            <Meta label="分类" value={product.category || "-"} />
            <Meta label="库位" value={product.location || "-"} />
            <Meta label="单位" value={product.unit || "-"} />
          </View>
          <View style={styles.actionRow}>
            {hasPermission("products_update") ? (
              <SecondaryButton label="编辑" onPress={() => { setEditing(product); setModalOpen(true); }} />
            ) : null}
            {hasPermission("products_delete") ? <DangerButton label="删除" onPress={() => removeProduct(product)} /> : null}
          </View>
        </InfoCard>
      ))}
      {!productsQuery.isLoading && products.length === 0 ? <EmptyState title="暂无货物" /> : null}
      <ProductFormModal
        open={modalOpen}
        product={editing}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await reload();
          setModalOpen(false);
          onToast({ type: "success", title: editing ? "货物已更新" : "货物已创建" });
        }}
        onError={(error) => onToast({ type: "error", title: "保存失败", message: getErrorMessage(error) })}
      />
    </RefreshableScreen>
  );
}

function ProductFormModal({
  onClose,
  onError,
  onSaved,
  open,
  product,
}: {
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
  open: boolean;
  product: Product | null;
}) {
  const [form, setForm] = useState({
    barcode: "",
    product_name: "",
    shelf_life_days: "30",
    location: "",
    category: "",
    unit: "",
    manufacturer: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      barcode: product?.barcode ?? "",
      product_name: product?.product_name ?? "",
      shelf_life_days: String(product?.shelf_life_days ?? 30),
      location: product?.location ?? "",
      category: product?.category ?? "",
      unit: product?.unit ?? "",
      manufacturer: product?.manufacturer ?? "",
    });
  }, [product, open]);

  const submit = async () => {
    const shelfLife = Number(form.shelf_life_days);
    if (!form.barcode.trim() || !form.product_name.trim() || !form.manufacturer.trim() || !Number.isInteger(shelfLife) || shelfLife <= 0) {
      onError(new Error("请完整填写条码、名称、厂商和有效保质期。"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, shelf_life_days: shelfLife };
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct(payload);
      }
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} title={product ? "编辑货物" : "新增货物"} onClose={onClose}>
      <TextField label="条码" value={form.barcode} onChangeText={(value) => setForm((current) => ({ ...current, barcode: value }))} />
      <TextField label="货物名称" value={form.product_name} onChangeText={(value) => setForm((current) => ({ ...current, product_name: value }))} />
      <TextField label="厂商" value={form.manufacturer} onChangeText={(value) => setForm((current) => ({ ...current, manufacturer: value }))} />
      <TextField label="保质期天数" keyboardType="numeric" value={form.shelf_life_days} onChangeText={(value) => setForm((current) => ({ ...current, shelf_life_days: value }))} />
      <TextField label="分类" value={form.category} onChangeText={(value) => setForm((current) => ({ ...current, category: value }))} />
      <TextField label="库位" value={form.location} onChangeText={(value) => setForm((current) => ({ ...current, location: value }))} />
      <TextField label="单位" value={form.unit} onChangeText={(value) => setForm((current) => ({ ...current, unit: value }))} />
      <PrimaryButton label="保存" icon={Save} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function InventoryScreen({ onToast }: { onToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [operationBatch, setOperationBatch] = useState<BatchDto | null>(null);
  const productsQuery = useQuery({ queryKey: queryKeys.products.list({ page: 1, size: 100 }), queryFn: () => listProducts({ page: 1, size: 100 }) });
  const batchesQuery = useQuery({ queryKey: queryKeys.batches.list({ page: 1, size: 100 }), queryFn: () => listBatches({ page: 1, size: 100 }) });
  const batches = batchesQuery.data?.items ?? [];
  const activeBatches = batches.filter((batch) => batch.status !== "used_up" && parseQuantity(batch.quantity) > 0);
  const totalQuantity = activeBatches.reduce((sum, batch) => sum + parseQuantity(batch.quantity), 0);
  const warningCount = activeBatches.filter((batch) => ["warning", "critical"].includes(batch.expiry_status ?? "")).length;
  const expiredCount = activeBatches.filter((batch) => batch.expiry_status === "expired" || (batch.days_until_expiry ?? 1) < 0).length;

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
  };

  return (
    <RefreshableScreen refreshing={batchesQuery.isRefetching || productsQuery.isRefetching} onRefresh={async () => { await productsQuery.refetch(); await batchesQuery.refetch(); }}>
      <PageIntro title="库存状态" description="查看批次库存、效期和库存操作。" />
      <View style={styles.statGrid}>
        <MetricCard label="当前库存" value={formatNumber(totalQuantity)} hint="批次数量汇总" />
        <MetricCard label="临期批次" value={String(warningCount)} hint="warning / critical" />
        <MetricCard label="已过期" value={String(expiredCount)} hint="需及时处理" />
      </View>
      {hasPermission("batch_operations_add") ? <PrimaryButton label="新增库存" icon={Plus} onPress={() => setBatchModalOpen(true)} /> : null}
      {batchesQuery.isLoading ? <LoadingCard label="正在加载库存" /> : null}
      {batchesQuery.error ? <InlineAlert type="error" message={getErrorMessage(batchesQuery.error)} /> : null}
      {activeBatches.map((batch) => (
        <BatchCard key={batch.id} batch={batch}>
          <View style={styles.actionRow}>
            {hasPermission("batch_operations_add") ? <SecondaryButton label="入库" onPress={() => setOperationBatch(batch)} /> : null}
            {hasPermission("batch_operations_deduct") ? <SecondaryButton label="出库" onPress={() => setOperationBatch(batch)} /> : null}
            {hasPermission("batch_operations_loss") ? <DangerButton label="报损" onPress={() => setOperationBatch(batch)} /> : null}
          </View>
        </BatchCard>
      ))}
      {!batchesQuery.isLoading && activeBatches.length === 0 ? <EmptyState title="暂无在库批次" /> : null}
      <NewBatchModal
        open={batchModalOpen}
        products={productsQuery.data?.items ?? []}
        onClose={() => setBatchModalOpen(false)}
        onSaved={async () => {
          await reload();
          setBatchModalOpen(false);
          onToast({ type: "success", title: "库存已入库" });
        }}
        onError={(error) => onToast({ type: "error", title: "入库失败", message: getErrorMessage(error) })}
      />
      <OperationModal
        batch={operationBatch}
        onClose={() => setOperationBatch(null)}
        onSaved={async () => {
          await reload();
          setOperationBatch(null);
          onToast({ type: "success", title: "库存操作已保存" });
        }}
        onError={(error) => onToast({ type: "error", title: "操作失败", message: getErrorMessage(error) })}
      />
    </RefreshableScreen>
  );
}

function NewBatchModal({
  onClose,
  onError,
  onSaved,
  open,
  products,
}: {
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
  open: boolean;
  products: Product[];
}) {
  const [productId, setProductId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [manufactureDate, setManufactureDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const candidates = products.filter((product) => {
    const q = query.trim().toLowerCase();
    return !q || product.product_name.toLowerCase().includes(q) || product.barcode.toLowerCase().includes(q);
  });
  const selectedProduct = products.find((product) => product.id === productId) ?? null;

  const submit = async () => {
    if (!selectedProduct || Number.parseFloat(quantity) <= 0 || !manufactureDate) {
      onError(new Error("请选择货物，并填写生产日期和有效数量。"));
      return;
    }
    setSubmitting(true);
    try {
      const batch = await createBatch({ product_id: selectedProduct.id, manufacture_date: manufactureDate, remarks });
      await createBatchOperation(batch.id, { operation_type: "add", quantity, remarks });
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} title="新增库存" onClose={onClose}>
      <SearchBox value={query} onChangeText={setQuery} placeholder="搜索货物" />
      <View style={styles.optionList}>
        {candidates.slice(0, 8).map((product) => (
          <Pressable key={product.id} style={[styles.optionCard, product.id === productId && styles.optionCardActive]} onPress={() => setProductId(product.id)}>
            <Text style={styles.optionTitle}>{product.product_name}</Text>
            <Text style={styles.optionSubtitle}>{product.barcode} · {product.manufacturer}</Text>
          </Pressable>
        ))}
      </View>
      {selectedProduct ? <InlineAlert type="success" message={`已选择 ${selectedProduct.product_name}`} /> : null}
      <TextField label="入库数量" value={quantity} keyboardType="decimal-pad" onChangeText={setQuantity} />
      <TextField label="生产日期 YYYY-MM-DD" value={manufactureDate} onChangeText={setManufactureDate} />
      <TextField label="备注" value={remarks} onChangeText={setRemarks} multiline />
      <PrimaryButton label="确认入库" icon={Save} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function OperationModal({
  batch,
  onClose,
  onError,
  onSaved,
}: {
  batch: BatchDto | null;
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
}) {
  const [operationType, setOperationType] = useState<BatchOperationType>("add");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (batch) {
      setOperationType("add");
      setQuantity("");
      setRemarks("");
    }
  }, [batch]);

  const submit = async () => {
    if (!batch || Number.parseFloat(quantity) <= 0) {
      onError(new Error("请输入有效数量。"));
      return;
    }
    setSubmitting(true);
    try {
      await createBatchOperation(batch.id, { operation_type: operationType, quantity, remarks });
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={Boolean(batch)} title={batch ? `批次 ${batch.batch_code}` : "库存操作"} onClose={onClose}>
      <Segmented
        value={operationType}
        options={[
          { label: "入库", value: "add" },
          { label: "出库", value: "deduct" },
          { label: "报损", value: "loss" },
        ]}
        onChange={(value) => setOperationType(value as BatchOperationType)}
      />
      <TextField label="数量" value={quantity} keyboardType="decimal-pad" onChangeText={setQuantity} />
      <TextField label="备注" value={remarks} onChangeText={setRemarks} multiline />
      <PrimaryButton label="保存操作" icon={Save} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function LossScreen({ onToast }: { onToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<BatchDto | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const batchesQuery = useQuery({ queryKey: queryKeys.batches.list({ page: 1, size: 100 }), queryFn: () => listBatches({ page: 1, size: 100 }) });
  const batches = (batchesQuery.data?.items ?? []).filter((batch) => parseQuantity(batch.quantity) > 0);

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.operations.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
  };

  return (
    <RefreshableScreen refreshing={batchesQuery.isRefetching} onRefresh={batchesQuery.refetch}>
      <PageIntro title="报损管理" description="按批次发起报损，并查看近期报损记录。" />
      {hasPermission("batch_operations_read") ? <SecondaryButton label="报损记录" icon={RefreshCcw} onPress={() => setHistoryOpen(true)} /> : null}
      {batchesQuery.isLoading ? <LoadingCard label="正在加载可报损批次" /> : null}
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch}>
          <PrimaryButton label="发起报损" icon={TriangleAlert} disabled={!hasPermission("batch_operations_loss")} onPress={() => setSelectedBatch(batch)} />
        </BatchCard>
      ))}
      <LossModal
        batch={selectedBatch}
        onClose={() => setSelectedBatch(null)}
        onSaved={async () => {
          await reload();
          setSelectedBatch(null);
          onToast({ type: "success", title: "报损已提交" });
        }}
        onError={(error) => onToast({ type: "error", title: "报损失败", message: getErrorMessage(error) })}
      />
      <LossHistoryModal
        open={historyOpen}
        batches={batches}
        onClose={() => setHistoryOpen(false)}
        onReverted={async () => {
          await reload();
          onToast({ type: "success", title: "报损已撤销" });
        }}
        onError={(error) => onToast({ type: "error", title: "撤销失败", message: getErrorMessage(error) })}
      />
    </RefreshableScreen>
  );
}

function LossModal({
  batch,
  onClose,
  onError,
  onSaved,
}: {
  batch: BatchDto | null;
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!batch || Number.parseFloat(quantity) <= 0) {
      onError(new Error("请输入有效报损数量。"));
      return;
    }
    if (Number.parseFloat(quantity) > parseQuantity(batch.quantity)) {
      onError(new Error("报损数量不能超过当前批次数量。"));
      return;
    }
    setSubmitting(true);
    try {
      await createBatchOperation(batch.id, { operation_type: "loss", quantity, remarks });
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={Boolean(batch)} title={batch ? `报损 ${batch.product.product_name}` : "报损"} onClose={onClose}>
      {batch ? <InlineAlert type="warning" message={`批次 ${batch.batch_code} 当前可用 ${formatNumber(parseQuantity(batch.quantity))}`} /> : null}
      <TextField label="报损数量" value={quantity} keyboardType="decimal-pad" onChangeText={setQuantity} />
      <TextField label="备注" value={remarks} onChangeText={setRemarks} multiline />
      <PrimaryButton label="提交报损" icon={TriangleAlert} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function LossHistoryModal({
  batches,
  onClose,
  onError,
  onReverted,
  open,
}: {
  batches: BatchDto[];
  onClose: () => void;
  onError: (error: unknown) => void;
  onReverted: () => Promise<void>;
  open: boolean;
}) {
  const { hasPermission } = useAuth();
  const historyQuery = useQuery({
    enabled: open,
    queryKey: ["mobile-loss-history", batches.map((batch) => batch.id).join(",")],
    queryFn: async () => {
      const groups = await Promise.all(
        batches.slice(0, 30).map(async (batch) => {
          const response = await listBatchOperations(batch.id, { operation_type: "loss", page: 1, size: 20 });
          return response.items.map((operation) => ({ batch, operation }));
        }),
      );
      return groups.flat().sort((left, right) => new Date(right.operation.created_at).getTime() - new Date(left.operation.created_at).getTime());
    },
  });

  const revert = (batch: BatchDto, operation: BatchOperationDto) => {
    Alert.alert("撤销报损", `确认撤销批次 ${batch.batch_code} 的报损记录吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "撤销",
        onPress: async () => {
          try {
            await revertBatchOperation(batch.id, operation.id, { remarks: "移动端撤销报损" });
            await onReverted();
            await historyQuery.refetch();
          } catch (error) {
            onError(error);
          }
        },
      },
    ]);
  };

  return (
    <Sheet open={open} title="报损记录" onClose={onClose}>
      {historyQuery.isLoading ? <LoadingCard label="正在加载记录" /> : null}
      {(historyQuery.data ?? []).map(({ batch, operation }) => (
        <InfoCard key={`${batch.id}-${operation.id}`}>
          <Text style={styles.cardTitle}>{batch.product.product_name}</Text>
          <Text style={styles.cardSubtitle}>{batch.batch_code} · {formatDateTime(operation.created_at)}</Text>
          <View style={styles.metaGrid}>
            <Meta label="报损数量" value={operation.quantity} />
            <Meta label="操作后" value={operation.quantity_after} />
          </View>
          {hasPermission("batch_operations_revert") && !operation.is_reverted && operation.reversed_operation_id === null ? (
            <DangerButton label="撤销" onPress={() => revert(batch, operation)} />
          ) : null}
        </InfoCard>
      ))}
      {!historyQuery.isLoading && (historyQuery.data ?? []).length === 0 ? <EmptyState title="暂无报损记录" /> : null}
    </Sheet>
  );
}

function QrScanScreen({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [qr, setQr] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof createQrScan>> | null>(null);

  const submitQr = async (value: string) => {
    if (!value.trim()) {
      onToast({ type: "warning", title: "请输入二维码" });
      return;
    }
    setSubmitting(true);
    try {
      const scanResult = await createQrScan({
        qr: value.trim(),
        source: cameraOpen ? "mobile_camera" : "handheld",
        deviceId: deviceId.trim() || null,
        clientScanId: `mobile-${Date.now()}`,
        scannedAt: new Date().toISOString(),
      });
      setResult(scanResult);
      setQr("");
      setCameraOpen(false);
      onToast({ type: scanResult.status === "valid" ? "success" : "warning", title: "扫码审计已提交", message: scanResult.message });
    } catch (error) {
      onToast({ type: "error", title: "扫码失败", message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        onToast({ type: "warning", title: "相机权限未开启" });
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (!submitting) {
      void submitQr(data);
    }
  };

  return (
    <RefreshableScreen>
      <PageIntro title="扫码审计" description="移动端可用相机扫码，也可粘贴外接扫码枪内容。" />
      {cameraOpen ? (
        <View style={styles.cameraPanel}>
          <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleBarcode} />
          <SecondaryButton label="关闭相机" icon={X} onPress={() => setCameraOpen(false)} />
        </View>
      ) : (
        <PrimaryButton label="打开相机扫码" icon={QrCode} onPress={openCamera} />
      )}
      <TextField label="二维码输入" value={qr} onChangeText={setQr} multiline />
      <TextField label="设备 ID" value={deviceId} onChangeText={setDeviceId} />
      <PrimaryButton label="提交审计" icon={Save} loading={submitting} onPress={() => void submitQr(qr)} />
      {result ? (
        <InfoCard>
          <View style={styles.cardHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.cardTitle}>{result.productName ?? "未识别货物"}</Text>
              <Text style={styles.cardSubtitle}>{result.message}</Text>
            </View>
            <StatusPill label={getQrStatusLabel(result.status)} tone={qrTone(result.status)} />
          </View>
          <View style={styles.metaGrid}>
            <Meta label="批次" value={result.batchCode ?? "-"} />
            <Meta label="到期" value={result.expireDate ? formatDate(result.expireDate) : "-"} />
            <Meta label="剩余天数" value={result.remainingDays === null ? "-" : String(result.remainingDays)} />
            <Meta label="审计 ID" value={result.auditId} />
          </View>
        </InfoCard>
      ) : null}
    </RefreshableScreen>
  );
}

function AnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>("6m");
  const analyticsQuery = useQuery({ queryKey: queryKeys.analytics.summary(range), queryFn: () => getAnalyticsSummary(range) });
  return (
    <RefreshableScreen refreshing={analyticsQuery.isRefetching} onRefresh={analyticsQuery.refetch}>
      <PageIntro title="库存分析" description="查看库存变动、报损、库龄和高风险批次。" />
      <Segmented
        value={range}
        options={[
          { label: "1月", value: "1m" },
          { label: "3月", value: "3m" },
          { label: "6月", value: "6m" },
          { label: "12月", value: "12m" },
        ]}
        onChange={(value) => setRange(value as AnalyticsRange)}
      />
      {analyticsQuery.isLoading ? <LoadingCard label="正在加载分析" /> : null}
      {analyticsQuery.error ? <InlineAlert type="error" message={getErrorMessage(analyticsQuery.error)} /> : null}
      {analyticsQuery.data ? (
        <>
          <View style={styles.statGrid}>
            <MetricCard label="库存变动" value={analyticsQuery.data.inventoryChangeCount} hint="有效操作次数" />
            <MetricCard label="当月报损" value={analyticsQuery.data.currentMonthLossQuantity} hint="数量汇总" />
            <MetricCard label="平均库龄" value={analyticsQuery.data.averageStockAgeDays} hint="天" />
          </View>
          <Section title="高风险库存">
            {analyticsQuery.data.highRiskRanking.length ? (
              analyticsQuery.data.highRiskRanking.map((item) => (
                <ListCard key={item.id} title={item.name} subtitle={`${item.batchCode} · ${item.riskType}`} right={item.daysLabel} tone={item.score >= 75 ? "critical" : "warning"} />
              ))
            ) : (
              <EmptyState title="暂无高风险库存" />
            )}
          </Section>
          <Section title="品类操作">
            {analyticsQuery.data.categoryOperations.map((item) => (
              <InfoCard key={item.category}>
                <Text style={styles.cardTitle}>{item.category}</Text>
                <View style={styles.metaGrid}>
                  <Meta label="入库" value={formatNumber(item.inbound)} />
                  <Meta label="出库/报损" value={formatNumber(item.outbound)} />
                </View>
              </InfoCard>
            ))}
          </Section>
        </>
      ) : null}
    </RefreshableScreen>
  );
}

function SettingsScreen({
  activeTab,
  onTabChange,
  onToast,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onToast: (toast: ToastState) => void;
}) {
  const { user } = useAuth();
  const options = [
    { label: "账号", value: "profile" },
    ...(user?.isSuperuser
      ? [
          { label: "用户", value: "users" },
          { label: "角色", value: "roles" },
          { label: "权限", value: "permissions" },
        ]
      : []),
  ];

  return (
    <RefreshableScreen>
      <PageIntro title="个人" description="查看账号信息，超级管理员可管理用户、角色和权限。" />
      <Segmented value={activeTab} options={options} onChange={(value) => onTabChange(value as SettingsTab)} />
      {activeTab === "profile" ? <ProfilePanel /> : null}
      {activeTab === "users" ? <UsersPanel onToast={onToast} /> : null}
      {activeTab === "roles" ? <RolesPanel onToast={onToast} /> : null}
      {activeTab === "permissions" ? <PermissionsPanel /> : null}
    </RefreshableScreen>
  );
}

function ProfilePanel() {
  const { user, hasPermission } = useAuth();
  if (!user) {
    return null;
  }
  return (
    <InfoCard>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{user.displayName}</Text>
          <Text style={styles.cardSubtitle}>{user.username} · {user.roleLabel}</Text>
        </View>
      </View>
      <View style={styles.metaGrid}>
        <Meta label="邮箱" value={user.email || "-"} />
        <Meta label="Staff" value={user.isStaff ? "是" : "否"} />
        <Meta label="超级管理员" value={user.isSuperuser ? "是" : "否"} />
        <Meta label="权限数量" value={String(user.permissions.length)} />
      </View>
      <View style={styles.chipWrap}>
        {["products_read", "batches_read", "dashboard_read", "analytics_read"].map((permission) => (
          <StatusPill key={permission} label={`${permission}: ${hasPermission(permission) ? "可访问" : "不可访问"}`} tone={hasPermission(permission) ? "success" : "warning"} />
        ))}
      </View>
    </InfoCard>
  );
}

function PermissionsPanel() {
  const permissionsQuery = useQuery({ queryKey: queryKeys.authManagement.permissions(), queryFn: listPermissions });
  return (
    <View>
      {permissionsQuery.isLoading ? <LoadingCard label="正在加载权限目录" /> : null}
      {(permissionsQuery.data ?? []).map((group) => (
        <InfoCard key={group.component}>
          <Text style={styles.cardTitle}>{group.component}</Text>
          {group.permissions.map((permission) => (
            <View key={permission.code} style={styles.permissionRow}>
              <Text style={styles.monoText}>{permission.code}</Text>
              <Text style={styles.cardSubtitle}>{permission.name} · {permission.action}</Text>
            </View>
          ))}
        </InfoCard>
      ))}
    </View>
  );
}

function RolesPanel({ onToast }: { onToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const permissionsQuery = useQuery({ queryKey: queryKeys.authManagement.permissions(), queryFn: listPermissions });
  const rolesQuery = useQuery({ queryKey: queryKeys.authManagement.roles(), queryFn: listRoles });
  const [editing, setEditing] = useState<AuthRole | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.roles() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.users() }),
    ]);
  };
  const remove = (role: AuthRole) => {
    Alert.alert("删除角色", `确认删除 ${role.name} 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRole(role.id);
            await reload();
            onToast({ type: "success", title: "角色已删除" });
          } catch (error) {
            onToast({ type: "error", title: "删除失败", message: getErrorMessage(error) });
          }
        },
      },
    ]);
  };
  return (
    <View>
      <PrimaryButton label="新增角色" icon={Plus} onPress={() => { setEditing(null); setModalOpen(true); }} />
      {rolesQuery.isLoading || permissionsQuery.isLoading ? <LoadingCard label="正在加载角色" /> : null}
      {(rolesQuery.data ?? []).map((role) => (
        <InfoCard key={role.id}>
          <Text style={styles.cardTitle}>{role.name}</Text>
          <Text style={styles.cardSubtitle}>{role.permissions.length} 项权限</Text>
          <View style={styles.actionRow}>
            <SecondaryButton label="编辑" onPress={() => { setEditing(role); setModalOpen(true); }} />
            <DangerButton label="删除" onPress={() => remove(role)} />
          </View>
        </InfoCard>
      ))}
      <RoleFormModal
        groups={permissionsQuery.data ?? []}
        role={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await reload();
          setModalOpen(false);
          onToast({ type: "success", title: editing ? "角色已更新" : "角色已创建" });
        }}
        onError={(error) => onToast({ type: "error", title: "保存失败", message: getErrorMessage(error) })}
      />
    </View>
  );
}

function RoleFormModal({
  groups,
  onClose,
  onError,
  onSaved,
  open,
  role,
}: {
  groups: PermissionGroup[];
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
  open: boolean;
  role: AuthRole | null;
}) {
  const [name, setName] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setName(role?.name ?? "");
    setPermissionCodes(role?.permissions ?? []);
  }, [role, open]);
  const submit = async () => {
    if (!name.trim()) {
      onError(new Error("请输入角色名称。"));
      return;
    }
    setSubmitting(true);
    try {
      if (role) {
        await updateRole(role.id, { name, permission_codes: permissionCodes });
      } else {
        await createRole({ name, permission_codes: permissionCodes });
      }
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Sheet open={open} title={role ? "编辑角色" : "新增角色"} onClose={onClose}>
      <TextField label="角色名称" value={name} onChangeText={setName} />
      <PermissionChooser groups={groups} selected={permissionCodes} onToggle={(code) => setPermissionCodes((current) => toggleString(current, code))} />
      <PrimaryButton label="保存角色" icon={Save} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function UsersPanel({ onToast }: { onToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const permissionsQuery = useQuery({ queryKey: queryKeys.authManagement.permissions(), queryFn: listPermissions });
  const rolesQuery = useQuery({ queryKey: queryKeys.authManagement.roles(), queryFn: listRoles });
  const usersQuery = useQuery({ queryKey: queryKeys.authManagement.users(), queryFn: listUsers });
  const [editing, setEditing] = useState<AuthAdminUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.users() });
  };
  return (
    <View>
      <PrimaryButton label="新增用户" icon={Plus} onPress={() => { setEditing(null); setModalOpen(true); }} />
      {usersQuery.isLoading || rolesQuery.isLoading || permissionsQuery.isLoading ? <LoadingCard label="正在加载用户" /> : null}
      {(usersQuery.data ?? []).map((item) => (
        <InfoCard key={item.id}>
          <Text style={styles.cardTitle}>{getAdminUserName(item)}</Text>
          <Text style={styles.cardSubtitle}>{item.username} · {item.email || "-"} · {item.is_active ? "启用" : "停用"}</Text>
          <Text style={styles.cardSubtitle}>角色：{item.groups.map((group) => group.name).join("、") || "-"}</Text>
          <SecondaryButton label="编辑" onPress={() => { setEditing(item); setModalOpen(true); }} />
        </InfoCard>
      ))}
      <UserFormModal
        groups={permissionsQuery.data ?? []}
        roles={rolesQuery.data ?? []}
        user={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await reload();
          setModalOpen(false);
          onToast({ type: "success", title: editing ? "用户已更新" : "用户已创建" });
        }}
        onError={(error) => onToast({ type: "error", title: "保存失败", message: getErrorMessage(error) })}
      />
    </View>
  );
}

function UserFormModal({
  groups,
  onClose,
  onError,
  onSaved,
  open,
  roles,
  user,
}: {
  groups: PermissionGroup[];
  onClose: () => void;
  onError: (error: unknown) => void;
  onSaved: () => Promise<void>;
  open: boolean;
  roles: AuthRole[];
  user: AuthAdminUser | null;
}) {
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    isActive: true,
    isStaff: false,
    groupIds: [] as number[],
    permissionCodes: [] as string[],
    resetPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    setForm({
      username: user?.username ?? "",
      password: "",
      email: user?.email ?? "",
      firstName: user?.first_name ?? "",
      lastName: user?.last_name ?? "",
      isActive: user?.is_active ?? true,
      isStaff: user?.is_staff ?? false,
      groupIds: user?.groups.map((group) => group.id) ?? [],
      permissionCodes: user?.direct_permissions ?? [],
      resetPassword: "",
    });
  }, [user, open]);

  const submit = async () => {
    if (!form.username.trim() || (!user && !form.password)) {
      onError(new Error("请输入用户名；新增用户还需要初始密码。"));
      return;
    }
    setSubmitting(true);
    try {
      if (user) {
        await updateUser(user.id, {
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          is_active: form.isActive,
          is_staff: form.isStaff,
          group_ids: form.groupIds,
          permission_codes: form.permissionCodes,
        });
      } else {
        await createUser({
          username: form.username,
          password: form.password,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          is_active: form.isActive,
          is_staff: form.isStaff,
          group_ids: form.groupIds,
          permission_codes: form.permissionCodes,
        });
      }
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!user || !form.resetPassword) {
      onError(new Error("请输入新密码。"));
      return;
    }
    setResetting(true);
    try {
      await resetUserPassword(user.id, form.resetPassword);
      setForm((current) => ({ ...current, resetPassword: "" }));
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Sheet open={open} title={user ? "编辑用户" : "新增用户"} onClose={onClose}>
      <TextField label="用户名" value={form.username} editable={!user} onChangeText={(value) => setForm((current) => ({ ...current, username: value }))} />
      {!user ? <TextField label="初始密码" value={form.password} secureTextEntry onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} /> : null}
      <TextField label="邮箱" value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} />
      <TextField label="姓" value={form.lastName} onChangeText={(value) => setForm((current) => ({ ...current, lastName: value }))} />
      <TextField label="名" value={form.firstName} onChangeText={(value) => setForm((current) => ({ ...current, firstName: value }))} />
      <View style={styles.switchRow}><Text style={styles.bodyText}>启用账号</Text><Switch value={form.isActive} onValueChange={(value) => setForm((current) => ({ ...current, isActive: value }))} /></View>
      <View style={styles.switchRow}><Text style={styles.bodyText}>Staff 用户</Text><Switch value={form.isStaff} onValueChange={(value) => setForm((current) => ({ ...current, isStaff: value }))} /></View>
      <Text style={styles.inputLabel}>角色</Text>
      <View style={styles.chipWrap}>
        {roles.map((role) => (
          <ChoiceChip key={role.id} label={role.name} selected={form.groupIds.includes(role.id)} onPress={() => setForm((current) => ({ ...current, groupIds: toggleNumber(current.groupIds, role.id) }))} />
        ))}
      </View>
      <PermissionChooser groups={groups} selected={form.permissionCodes} onToggle={(code) => setForm((current) => ({ ...current, permissionCodes: toggleString(current.permissionCodes, code) }))} />
      {user ? (
        <>
          <TextField label="重置密码" value={form.resetPassword} secureTextEntry onChangeText={(value) => setForm((current) => ({ ...current, resetPassword: value }))} />
          <SecondaryButton label="重置密码" loading={resetting} onPress={resetPassword} />
        </>
      ) : null}
      <PrimaryButton label="保存用户" icon={Save} loading={submitting} onPress={submit} />
    </Sheet>
  );
}

function PermissionChooser({ groups, onToggle, selected }: { groups: PermissionGroup[]; onToggle: (code: string) => void; selected: string[] }) {
  return (
    <View>
      <Text style={styles.inputLabel}>权限</Text>
      {groups.map((group) => (
        <View key={group.component} style={styles.permissionGroup}>
          <Text style={styles.permissionGroupTitle}>{group.component}</Text>
          <View style={styles.chipWrap}>
            {group.permissions.map((permission) => (
              <ChoiceChip key={permission.code} label={permission.code} selected={selected.includes(permission.code)} onPress={() => onToggle(permission.code)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function BatchCard({ batch, children }: { batch: BatchDto; children?: React.ReactNode }) {
  const remainingDays = batch.days_until_expiry ?? null;
  const tone = batch.expiry_status === "expired" ? "critical" : batch.expiry_status === "critical" || batch.expiry_status === "warning" ? "warning" : "success";
  return (
    <InfoCard>
      <View style={styles.cardHeaderRow}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{batch.product.product_name}</Text>
          <Text style={styles.cardSubtitle}>{batch.batch_code} · {batch.product.barcode}</Text>
        </View>
        <StatusPill label={batch.expiry_status ?? "normal"} tone={tone} />
      </View>
      <View style={styles.metaGrid}>
        <Meta label="数量" value={batch.quantity} />
        <Meta label="生产日期" value={batch.manufacture_date ?? "-"} />
        <Meta label="到期日期" value={batch.expire_date ? formatDate(batch.expire_date) : "-"} />
        <Meta label="剩余天数" value={remainingDays === null ? "-" : String(remainingDays)} />
      </View>
      {children}
    </InfoCard>
  );
}

function RefreshableScreen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  onRefresh?: () => unknown;
  refreshing?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function Sheet({ children, onClose, open, title }: { children: React.ReactNode; onClose: () => void; open: boolean; title: string }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <X color={tokens.onSurfaceVariant} size={20} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PageIntro({ description, title }: { description: string; title: string }) {
  return (
    <View style={styles.pageIntro}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageDescription}>{description}</Text>
    </View>
  );
}

function Section({ children, subtitle, title }: { children: React.ReactNode; subtitle?: string; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function MetricCard({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function ListCard({
  right,
  subtitle,
  title,
  tone = "success",
}: {
  right?: string;
  subtitle: string;
  title: string;
  tone?: "success" | "warning" | "critical" | "normal";
}) {
  return (
    <View style={styles.listCard}>
      <View style={styles.flexOne}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      {right ? <StatusPill label={right} tone={tone === "normal" ? "success" : tone} /> : null}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function TextField({ label, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#7B8190"
        style={[styles.input, props.multiline && styles.textArea, style]}
        {...props}
      />
    </View>
  );
}

function SearchBox(props: React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.searchBox}>
      <Search color={tokens.onSurfaceVariant} size={18} />
      <TextInput placeholderTextColor="#7B8190" style={styles.searchInput} {...props} />
    </View>
  );
}

function PrimaryButton({
  disabled,
  icon: Icon,
  label,
  loading,
  onPress,
}: {
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabledButton]} disabled={disabled || loading} onPress={onPress}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : Icon ? <Icon color="#FFFFFF" size={18} /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  icon: Icon,
  label,
  loading,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.secondaryButton} disabled={loading} onPress={onPress}>
      {loading ? <ActivityIndicator color={tokens.primary} /> : Icon ? <Icon color={tokens.primary} size={17} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.dangerButton} onPress={onPress}>
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

function Segmented({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(option.value)}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress}>
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label, tone = "normal" }: { label: string; tone?: "success" | "warning" | "critical" | "normal" }) {
  return <Text style={[styles.pill, tone === "success" && styles.pillSuccess, tone === "warning" && styles.pillWarning, tone === "critical" && styles.pillCritical]}>{label}</Text>;
}

function InlineAlert({ message, type }: { message: string; type: ToastType }) {
  return (
    <View style={[styles.inlineAlert, type === "error" && styles.inlineAlertError, type === "warning" && styles.inlineAlertWarning]}>
      <Text style={[styles.inlineAlertText, type === "error" && styles.inlineAlertErrorText]}>{message}</Text>
    </View>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={tokens.primary} />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
    </View>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.bodyText}>{label}</Text>
        <Text style={styles.bodyText}>{value}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, value))}%` }]} />
      </View>
    </View>
  );
}

function Toast({ onClose, toast }: { onClose: () => void; toast: ToastState | null }) {
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [onClose, toast]);

  if (!toast) {
    return null;
  }

  return (
    <Pressable style={[styles.toast, toast.type === "error" && styles.toastError, toast.type === "warning" && styles.toastWarning]} onPress={onClose}>
      <Text style={styles.toastTitle}>{toast.title}</Text>
      {toast.message ? <Text style={styles.toastMessage}>{toast.message}</Text> : null}
    </Pressable>
  );
}

function getErrorMessage(error: unknown, fallback = "请求失败，请稍后重试。") {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "登录状态已失效，请重新登录。";
    }
    if (error.status === 403) {
      return "当前账号没有执行该操作的权限。";
    }
    if (error.message === "validation_error") {
      return "提交内容不完整或格式不正确。";
    }
    if (error.message === "conflict") {
      return "数据冲突，请刷新后重试。";
    }
    return `请求失败：${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function toggleString(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function toggleNumber(list: number[], value: number) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function getAdminUserName(user: AuthAdminUser) {
  return [user.last_name, user.first_name].filter(Boolean).join("") || user.username;
}

function getQrStatusLabel(status: string) {
  const labels: Record<string, string> = {
    valid: "有效",
    near_expiry: "临期",
    expired: "已过期",
    invalid: "无效",
    revoked: "已吊销",
    not_found: "未找到",
  };
  return labels[status] ?? status;
}

function qrTone(status: string) {
  if (status === "valid") {
    return "success";
  }
  if (status === "near_expiry") {
    return "warning";
  }
  return "critical";
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const tokens = {
  primary: "#0057C2",
  primaryContainer: "#006EF2",
  surface: "#F9F9F9",
  surfaceContainer: "#EEEEEE",
  surfaceContainerLow: "#F3F3F3",
  surfaceContainerHigh: "#E8E8E8",
  surfaceContainerLowest: "#FFFFFF",
  onSurface: "#1B1B1B",
  onSurfaceVariant: "#414755",
  error: "#BA1A1A",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.surface,
  },
  app: {
    flex: 1,
    backgroundColor: tokens.surface,
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loginScreen: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  brandMark: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#EAF2FF",
  },
  loginTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: tokens.onSurface,
  },
  loginSubtitle: {
    fontSize: 16,
    color: tokens.onSurfaceVariant,
    marginBottom: 12,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: tokens.surfaceContainer,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.onSurface,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: tokens.onSurfaceVariant,
  },
  content: {
    flex: 1,
  },
  secondaryNav: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.surfaceContainer,
    backgroundColor: tokens.surface,
    paddingVertical: 10,
  },
  secondaryNavContent: {
    paddingHorizontal: 18,
    gap: 8,
  },
  secondaryNavItem: {
    minHeight: 38,
    minWidth: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    backgroundColor: tokens.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryNavItemActive: {
    borderColor: tokens.primary,
    backgroundColor: "#EAF2FF",
  },
  secondaryNavLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.onSurfaceVariant,
  },
  secondaryNavLabelActive: {
    color: tokens.primary,
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: 18,
    paddingBottom: 112,
    gap: 14,
  },
  pageIntro: {
    gap: 4,
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: tokens.onSurface,
  },
  pageDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: tokens.onSurfaceVariant,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: tokens.surfaceContainer,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingVertical: 10,
  },
  bottomNavContent: {
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  navItem: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
  },
  navItemActive: {
    backgroundColor: "#EAF2FF",
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.onSurfaceVariant,
  },
  navLabelActive: {
    color: tokens.primary,
  },
  card: {
    borderRadius: 24,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "rgba(238,238,238,0.9)",
    padding: 18,
    gap: 14,
    shadowColor: "#1B1B1B",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.onSurface,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.onSurfaceVariant,
  },
  flexOne: {
    flex: 1,
  },
  statGrid: {
    gap: 12,
  },
  metricCard: {
    borderRadius: 22,
    backgroundColor: tokens.surfaceContainerLowest,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.onSurfaceVariant,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "900",
    color: tokens.onSurface,
  },
  metricHint: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.onSurfaceVariant,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: tokens.onSurface,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: tokens.onSurfaceVariant,
  },
  listCard: {
    borderRadius: 20,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    width: "47%",
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: tokens.surfaceContainerLow,
    padding: 12,
    justifyContent: "center",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.onSurfaceVariant,
  },
  metaValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: "800",
    color: tokens.onSurface,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  field: {
    gap: 7,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.onSurface,
  },
  input: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: tokens.onSurface,
    fontSize: 15,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  searchBox: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: tokens.onSurface,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: tokens.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: tokens.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  dangerButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#FFD4D4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  dangerButtonText: {
    color: tokens.error,
    fontWeight: "900",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: tokens.surfaceContainerLow,
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.surfaceContainerLowest,
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.surfaceContainer,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: tokens.onSurface,
  },
  sheetContent: {
    padding: 18,
    gap: 14,
    paddingBottom: 34,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(27,27,27,0.35)",
    justifyContent: "flex-end",
  },
  switchRow: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: tokens.surfaceContainerLow,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bodyText: {
    fontSize: 14,
    color: tokens.onSurface,
    fontWeight: "700",
  },
  mutedText: {
    fontSize: 14,
    color: tokens.onSurfaceVariant,
  },
  helpText: {
    fontSize: 12,
    color: tokens.onSurfaceVariant,
    lineHeight: 18,
  },
  inlineAlert: {
    borderRadius: 18,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#B7E4C7",
    padding: 13,
  },
  inlineAlertWarning: {
    backgroundColor: "#FFF8E6",
    borderColor: "#FFE1A3",
  },
  inlineAlertError: {
    backgroundColor: "#FFF1F1",
    borderColor: "#FFD4D4",
  },
  inlineAlertText: {
    color: "#166534",
    fontWeight: "700",
    lineHeight: 19,
  },
  inlineAlertErrorText: {
    color: tokens.error,
  },
  loadingCard: {
    borderRadius: 22,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyState: {
    minHeight: 110,
    borderRadius: 22,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyTitle: {
    color: tokens.onSurfaceVariant,
    fontWeight: "800",
  },
  pill: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.surfaceContainerLow,
    color: tokens.onSurfaceVariant,
    fontSize: 12,
    fontWeight: "900",
  },
  pillSuccess: {
    backgroundColor: "#EAF2FF",
    color: tokens.primary,
  },
  pillWarning: {
    backgroundColor: "#FFF8E6",
    color: "#A16207",
  },
  pillCritical: {
    backgroundColor: "#FFF1F1",
    color: tokens.error,
  },
  segmented: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: tokens.surfaceContainerLow,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: tokens.surfaceContainerLowest,
  },
  segmentText: {
    color: tokens.onSurfaceVariant,
    fontSize: 13,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: tokens.primary,
  },
  optionList: {
    gap: 8,
    maxHeight: 300,
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    backgroundColor: tokens.surfaceContainerLowest,
    padding: 13,
  },
  optionCardActive: {
    borderColor: tokens.primary,
    backgroundColor: "#EAF2FF",
  },
  optionTitle: {
    color: tokens.onSurface,
    fontWeight: "800",
  },
  optionSubtitle: {
    marginTop: 3,
    color: tokens.onSurfaceVariant,
    fontSize: 12,
  },
  chartBars: {
    minHeight: 130,
    borderRadius: 22,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chartBarItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  chartBar: {
    width: "70%",
    maxHeight: 92,
    borderRadius: 999,
    backgroundColor: tokens.primary,
  },
  chartBarCritical: {
    backgroundColor: tokens.error,
  },
  chartLabel: {
    fontSize: 10,
    color: tokens.onSurfaceVariant,
  },
  progressRow: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.surfaceContainerHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.primary,
  },
  cameraPanel: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    gap: 12,
    padding: 12,
  },
  camera: {
    height: 320,
    borderRadius: 18,
    overflow: "hidden",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    color: tokens.primary,
    fontWeight: "900",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.surfaceContainer,
    backgroundColor: tokens.surfaceContainerLowest,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  choiceChipSelected: {
    borderColor: tokens.primary,
    backgroundColor: "#EAF2FF",
  },
  choiceChipText: {
    color: tokens.onSurfaceVariant,
    fontSize: 12,
    fontWeight: "800",
  },
  choiceChipTextSelected: {
    color: tokens.primary,
  },
  permissionRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.surfaceContainer,
    paddingTop: 10,
    gap: 4,
  },
  monoText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: tokens.primary,
    fontWeight: "800",
  },
  permissionGroup: {
    gap: 8,
    paddingVertical: 8,
  },
  permissionGroupTitle: {
    color: tokens.onSurfaceVariant,
    fontWeight: "900",
    fontSize: 12,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 86,
    borderRadius: 20,
    backgroundColor: tokens.primary,
    padding: 15,
    shadowColor: "#1B1B1B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  toastWarning: {
    backgroundColor: "#A16207",
  },
  toastError: {
    backgroundColor: tokens.error,
  },
  toastTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  toastMessage: {
    marginTop: 3,
    color: "#FFFFFF",
    lineHeight: 19,
  },
});
