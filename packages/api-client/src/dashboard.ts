import type { ApiClient } from "./client";
import { defaultApiClient, isApiClient } from "./client";
import type { BatchDto } from "./batches";
import { getShelfLifeMetricsFromBatch, parseQuantity } from "./inventory";
import type { Category, DashboardStat, TrendDataPoint, UrgentItem } from "./types";

interface ExpiryTrendPointDto {
  date: string;
  batch_count: number;
  quantity: string;
}

interface CategoryInventoryDistributionDto {
  category: string;
  batch_count: number;
  quantity: string;
  ratio: number;
}

type DashboardBatchDto = BatchDto & {
  product: BatchDto["product"] & {
    category?: string | null;
    location?: string | null;
  };
};

export interface DashboardOverviewDto {
  current_inventory_quantity: string;
  near_expiry_batch_count: number;
  expired_batch_count: number;
  batch_health_rate: number;
  expiry_trend_30d: ExpiryTrendPointDto[];
  category_inventory_distribution: CategoryInventoryDistributionDto[];
  top_near_expiry_batches: DashboardBatchDto[];
}

export interface DashboardData {
  stats: DashboardStat[];
  trendData: TrendDataPoint[];
  categories: Category[];
  urgentItems: UrgentItem[];
  lastUpdatedAt: string;
}

const CATEGORY_COLORS = ["bg-primary", "bg-primary/80", "bg-primary/60", "bg-primary/40", "bg-primary/20"];
const DEFAULT_CATEGORY_COLOR = "bg-primary";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  stats: [
    {
      id: "total-stock",
      title: "当前在库数量",
      value: "0",
      trend: "等待后端数据",
      trendType: "neutral",
      icon: "package",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      id: "expiring-soon",
      title: "7天内临期批次",
      value: "0",
      trend: "需优先关注",
      trendType: "neutral",
      icon: "timer",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
    {
      id: "expired-batches",
      title: "已过期批次",
      value: "0",
      trend: "需及时处理",
      trendType: "down",
      icon: "alert",
      iconBg: "bg-error/10",
      iconColor: "text-error",
    },
    {
      id: "health-index",
      title: "批次健康率",
      value: "100%",
      trend: "健康批次占比",
      trendType: "up",
      icon: "shield",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600",
    },
  ],
  trendData: [],
  categories: [],
  urgentItems: [],
  lastUpdatedAt: "--:--",
};

function formatQuantity(value: string) {
  return parseQuantity(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatTrendDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatUpdatedAt() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTrendType(point: ExpiryTrendPointDto): TrendDataPoint["type"] {
  if (point.batch_count <= 0) {
    return "normal";
  }

  const today = new Date();
  const date = new Date(`${point.date}T00:00:00`);
  const dayDiff = Math.ceil((date.getTime() - new Date(today.toDateString()).getTime()) / (24 * 60 * 60 * 1000));
  return dayDiff <= 7 ? "critical" : "warning";
}

function getUrgentStatus(batch: DashboardBatchDto): UrgentItem["status"] {
  const metrics = getShelfLifeMetricsFromBatch(batch);

  if (batch.expiry_status === "expired" || metrics.remainingDays <= 3 || metrics.health === "critical") {
    return "critical";
  }

  if (metrics.remainingDays <= 7 || metrics.health === "warning") {
    return "warning";
  }

  return "normal";
}

function toUrgentItem(batch: DashboardBatchDto): UrgentItem {
  const metrics = getShelfLifeMetricsFromBatch(batch);
  const productName = batch.product.product_name;

  return {
    id: String(batch.id),
    name: productName,
    batchId: `#${batch.batch_code}`,
    location: batch.product.location ?? "未分配库位",
    stock: parseQuantity(batch.quantity),
    daysLeft: metrics.remainingDays,
    status: getUrgentStatus(batch),
    initial: productName.trim().charAt(0).toUpperCase() || "?",
  };
}

function toDashboardData(dto: DashboardOverviewDto): DashboardData {
  const healthRate = Math.max(0, Math.min(1, dto.batch_health_rate));

  return {
    stats: [
      {
        id: "total-stock",
        title: "当前在库数量",
        value: formatQuantity(dto.current_inventory_quantity),
        trend: "按可用批次汇总",
        trendType: "up",
        icon: "package",
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
      },
      {
        id: "expiring-soon",
        title: "7天内临期批次",
        value: dto.near_expiry_batch_count.toLocaleString("zh-CN"),
        trend: "需优先关注",
        trendType: dto.near_expiry_batch_count > 0 ? "neutral" : "up",
        icon: "timer",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-600",
      },
      {
        id: "expired-batches",
        title: "已过期批次",
        value: dto.expired_batch_count.toLocaleString("zh-CN"),
        trend: "需及时处理",
        trendType: dto.expired_batch_count > 0 ? "critical" : "down",
        icon: "alert",
        iconBg: "bg-error/10",
        iconColor: "text-error",
      },
      {
        id: "health-index",
        title: "批次健康率",
        value: formatPercent(healthRate),
        trend: "健康批次占比",
        trendType: healthRate >= 0.9 ? "up" : healthRate >= 0.75 ? "neutral" : "critical",
        icon: "shield",
        iconBg: "bg-green-500/10",
        iconColor: "text-green-600",
      },
    ],
    trendData: dto.expiry_trend_30d.map((point) => ({
      name: formatTrendDate(point.date),
      value: point.batch_count,
      type: getTrendType(point),
    })),
    categories: dto.category_inventory_distribution.map((category, index) => ({
      name: category.category,
      percentage: Math.round(category.ratio * 1000) / 10,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? DEFAULT_CATEGORY_COLOR,
    })),
    urgentItems: dto.top_near_expiry_batches.slice(0, 5).map(toUrgentItem),
    lastUpdatedAt: formatUpdatedAt(),
  };
}

export function getDashboardSnapshot() {
  return EMPTY_DASHBOARD_DATA;
}

function resolveClient(clientOrContext: ApiClient | unknown) {
  return isApiClient(clientOrContext) ? clientOrContext : defaultApiClient;
}

export async function getDashboardOverview(clientOrContext?: ApiClient | unknown) {
  const client = resolveClient(clientOrContext);
  return client.requestJson<DashboardOverviewDto>("/dashboard/overview");
}

export async function getDashboardData(clientOrContext?: ApiClient | unknown) {
  const client = resolveClient(clientOrContext);
  const data = await getDashboardOverview(client);
  return toDashboardData(data);
}
