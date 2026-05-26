export interface ApiSuccessResponse<T> {
  code: 0;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  code: number;
  message: string;
  data: null;
}

export interface ApiPagination {
  page: number;
  size: number;
  total: number;
}

export interface ApiListData<T> {
  items: T[];
  pagination: ApiPagination | null;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: number | null;

  constructor(message: string, status: number, code: number | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export interface Product {
  id: number;
  barcode: string;
  product_name: string;
  shelf_life_days: number;
  location: string | null;
  category: string | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
  manufacturer: string;
}

export type InventoryHealth = "healthy" | "warning" | "critical";

export interface ShelfLifeMetrics {
  percent: number;
  remainingDays: number;
  health: InventoryHealth;
}

export type DashboardTrendType = "up" | "down" | "neutral" | "critical";
export type DashboardStatIcon = "package" | "timer" | "alert" | "shield";

export interface DashboardStat {
  id: string;
  title: string;
  value: string;
  trend?: string;
  trendType?: DashboardTrendType;
  icon: DashboardStatIcon;
  iconBg: string;
  iconColor: string;
}

export interface UrgentItem {
  id: string;
  name: string;
  batchId: string;
  location: string;
  stock: number;
  daysLeft: number;
  status: "critical" | "warning" | "normal";
  initial: string;
}

export interface Category {
  name: string;
  percentage: number;
  color: string;
}

export interface TrendDataPoint {
  date: string;
  name: string;
  value: number;
  quantity: number;
  type: "normal" | "warning" | "critical";
}
