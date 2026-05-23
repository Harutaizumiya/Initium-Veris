import type { ApiClient } from "./client";
import { defaultApiClient } from "./client";
import type { BatchDto } from "./batches";
import { getShelfLifeMetricsFromBatch, parseQuantity } from "./inventory";

export type AnalyticsRange = "1m" | "3m" | "6m" | "12m";

interface AnalyticsPeriodDto {
  start: string;
  end: string;
}

interface MonthlyInventoryLossTrendDto {
  month: string;
  inventory_quantity: string;
  loss_quantity: string;
}

interface CategoryOperationSummaryDto {
  category: string;
  inbound_quantity: string;
  outbound_loss_quantity: string;
  operation_count: number;
}

export interface AnalyticsSummaryDto {
  range: AnalyticsRange;
  period: AnalyticsPeriodDto;
  inventory_change_count: number;
  current_month_loss_quantity: string;
  average_stock_age_days: number | null;
  monthly_inventory_loss_trend: MonthlyInventoryLossTrendDto[];
  category_operation_summary: CategoryOperationSummaryDto[];
  high_risk_inventory_ranking: BatchDto[];
}

export interface AnalyticsTrendPoint {
  month: string;
  stockQuantity: number;
  lossQuantity: number;
}

export interface CategoryOperationPoint {
  category: string;
  inbound: number;
  outbound: number;
}

export interface RiskRankingItem {
  id: string;
  name: string;
  batchCode: string;
  riskType: string;
  daysLabel: string;
  score: number;
  color: string;
}

export interface AnalyticsData {
  range: AnalyticsRange;
  period: AnalyticsPeriodDto | null;
  inventoryChangeCount: string;
  currentMonthLossQuantity: string;
  averageStockAgeDays: string;
  stockLossTrend: AnalyticsTrendPoint[];
  categoryOperations: CategoryOperationPoint[];
  highRiskRanking: RiskRankingItem[];
}

const EMPTY_ANALYTICS_DATA: AnalyticsData = {
  range: "6m",
  period: null,
  inventoryChangeCount: "0",
  currentMonthLossQuantity: "0",
  averageStockAgeDays: "-",
  stockLossTrend: [],
  categoryOperations: [],
  highRiskRanking: [],
};

function formatQuantity(value: string) {
  return parseQuantity(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  });
}

function formatMonth(value: string) {
  const [, month] = value.split("-");
  return `${Number(month)}月`;
}

function toRiskType(batch: BatchDto, remainingDays: number) {
  if (batch.expiry_status === "expired" || remainingDays < 0) {
    return "已过期";
  }
  if (remainingDays <= 7) {
    return "临期批次";
  }
  if (batch.expiry_status === "critical") {
    return "效期高风险";
  }
  if (batch.expiry_status === "warning") {
    return "效期预警";
  }
  return "库存关注";
}

function toRiskScore(batch: BatchDto, remainingDays: number) {
  const progressScore = typeof batch.expiry_progress === "number" ? Math.round(batch.expiry_progress * 100) : null;
  const fallbackScore = remainingDays < 0 ? 100 : Math.max(40, 100 - remainingDays * 4);
  return Math.max(0, Math.min(100, progressScore ?? fallbackScore));
}

function toRiskColor(score: number, remainingDays: number) {
  if (remainingDays < 0) {
    return "text-red-600";
  }
  if (score >= 75) {
    return "text-amber-700";
  }
  if (score >= 60) {
    return "text-amber-600";
  }
  return "text-primary";
}

function toDaysLabel(remainingDays: number) {
  if (remainingDays < 0) {
    return `已过期 ${Math.abs(remainingDays)} 天`;
  }
  return `${remainingDays} 天`;
}

function toRiskRankingItem(batch: BatchDto): RiskRankingItem {
  const metrics = getShelfLifeMetricsFromBatch(batch);
  const score = toRiskScore(batch, metrics.remainingDays);

  return {
    id: String(batch.id),
    name: batch.product.product_name,
    batchCode: batch.batch_code,
    riskType: toRiskType(batch, metrics.remainingDays),
    daysLabel: toDaysLabel(metrics.remainingDays),
    score,
    color: toRiskColor(score, metrics.remainingDays),
  };
}

function toAnalyticsData(dto: AnalyticsSummaryDto): AnalyticsData {
  return {
    range: dto.range,
    period: dto.period,
    inventoryChangeCount: dto.inventory_change_count.toLocaleString("zh-CN"),
    currentMonthLossQuantity: formatQuantity(dto.current_month_loss_quantity),
    averageStockAgeDays:
      dto.average_stock_age_days === null
        ? "-"
        : dto.average_stock_age_days.toLocaleString("zh-CN", {
            maximumFractionDigits: 1,
          }),
    stockLossTrend: dto.monthly_inventory_loss_trend.map((point) => ({
      month: formatMonth(point.month),
      stockQuantity: parseQuantity(point.inventory_quantity),
      lossQuantity: parseQuantity(point.loss_quantity),
    })),
    categoryOperations: dto.category_operation_summary.map((item) => ({
      category: item.category,
      inbound: parseQuantity(item.inbound_quantity),
      outbound: parseQuantity(item.outbound_loss_quantity),
    })),
    highRiskRanking: dto.high_risk_inventory_ranking.slice(0, 10).map(toRiskRankingItem),
  };
}

export function getAnalyticsSnapshot(): AnalyticsData {
  return EMPTY_ANALYTICS_DATA;
}

export async function getAnalyticsSummaryDto(range: AnalyticsRange = "6m", client: ApiClient = defaultApiClient) {
  const query = new URLSearchParams({ range }).toString();
  return client.requestJson<AnalyticsSummaryDto>(`/analytics/summary?${query}`);
}

export async function getAnalyticsSummary(range: AnalyticsRange = "6m", client: ApiClient = defaultApiClient) {
  const data = await getAnalyticsSummaryDto(range, client);
  return toAnalyticsData(data);
}
