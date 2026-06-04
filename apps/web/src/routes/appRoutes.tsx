import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type AppRouteComponent = LazyExoticComponent<ComponentType>;

export interface AppRoute {
  component: AppRouteComponent;
  icon: LucideIcon;
  label: string;
  menuGroup: "main" | "footer";
  path: string;
  permissionMode?: "all" | "any";
  requiredPermissions?: string[];
  requiresSuperuser?: boolean;
}

const DashboardPage = lazy(() => import("../components/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProductManagementPage = lazy(() =>
  import("../components/pages/ProductManagementPage").then((module) => ({ default: module.ProductManagementPage })),
);
const InventoryStatusPage = lazy(() =>
  import("../components/pages/InventoryStatusPage").then((module) => ({ default: module.InventoryStatusPage })),
);
const LossReportPage = lazy(() => import("../components/pages/LossReportPage").then((module) => ({ default: module.LossReportPage })));
const QrScanPage = lazy(() => import("../components/pages/QrScanPage").then((module) => ({ default: module.QrScanPage })));
const AnalyticsPage = lazy(() => import("../components/pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const StocktakePage = lazy(() => import("../components/pages/StocktakePage").then((module) => ({ default: module.StocktakePage })));
const SettingsProfilePage = lazy(() => import("../components/pages/SettingsPage").then((module) => ({ default: module.SettingsProfilePage })));
const UserManagementPage = lazy(() => import("../components/pages/SettingsPage").then((module) => ({ default: module.UserManagementPage })));
const RoleManagementPage = lazy(() => import("../components/pages/SettingsPage").then((module) => ({ default: module.RoleManagementPage })));
const PermissionDirectoryPage = lazy(() =>
  import("../components/pages/SettingsPage").then((module) => ({ default: module.PermissionDirectoryPage })),
);

export const appRoutes: AppRoute[] = [
  {
    component: DashboardPage,
    icon: LayoutDashboard,
    label: "总览",
    menuGroup: "main",
    path: "/",
    requiredPermissions: ["dashboard_read"],
  },
  {
    component: ProductManagementPage,
    icon: Boxes,
    label: "货物管理",
    menuGroup: "main",
    path: "/products",
    requiredPermissions: ["products_read"],
  },
  {
    component: InventoryStatusPage,
    icon: Package,
    label: "库存状态",
    menuGroup: "main",
    path: "/inventory-status",
    permissionMode: "all",
    requiredPermissions: ["batches_read", "dashboard_read"],
  },
  {
    component: LossReportPage,
    icon: TriangleAlert,
    label: "报损",
    menuGroup: "main",
    path: "/loss-report",
    permissionMode: "all",
    requiredPermissions: ["products_read", "batches_read"],
  },
  {
    component: QrScanPage,
    icon: QrCode,
    label: "扫码审计",
    menuGroup: "main",
    path: "/qr-scan",
    requiredPermissions: ["qr_scans_create"],
  },
  {
    component: StocktakePage,
    icon: ClipboardCheck,
    label: "库存盘点",
    menuGroup: "main",
    path: "/stocktakes",
    requiredPermissions: ["stocktakes_read"],
  },
  {
    component: AnalyticsPage,
    icon: BarChart3,
    label: "分析",
    menuGroup: "main",
    path: "/analysis",
    requiredPermissions: ["analytics_read"],
  },
  {
    component: SettingsProfilePage,
    icon: UserRound,
    label: "账号信息",
    menuGroup: "footer",
    path: "/settings/profile",
  },
  {
    component: UserManagementPage,
    icon: UserCog,
    label: "用户管理",
    menuGroup: "footer",
    path: "/settings/users",
    requiresSuperuser: true,
  },
  {
    component: RoleManagementPage,
    icon: ShieldCheck,
    label: "角色管理",
    menuGroup: "footer",
    path: "/settings/roles",
    requiresSuperuser: true,
  },
  {
    component: PermissionDirectoryPage,
    icon: KeyRound,
    label: "权限目录",
    menuGroup: "footer",
    path: "/settings/permissions",
    requiresSuperuser: true,
  },
];

export const mainMenuRoutes = appRoutes.filter((route) => route.menuGroup === "main");
export const footerMenuRoutes = appRoutes.filter((route) => route.menuGroup === "footer");
export const settingsRootRoute = {
  icon: Settings,
  label: "设置",
  path: "/settings/profile",
};
