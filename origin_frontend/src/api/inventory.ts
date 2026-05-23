import type { Product } from "../components/pages/ProductManagement.types";
import type { ExpiryStatus, InventoryBatchDetail, InventoryHealth, InventoryRecord, InventoryRelatedBatch } from "../components/pages/InventoryStatus.types";
import type { BatchDto } from "./batches";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null) {
  return value ? new Date(value) : null;
}

export function parseQuantity(quantity: string) {
  return Number.parseFloat(quantity) || 0;
}

export function getShelfLifeMetricsFromDates(expireDate: string | null, manufactureDate: string | null) {
  const now = new Date();
  const expire = parseDate(expireDate);
  const manufacture = parseDate(manufactureDate);

  if (!expire) {
    return { percent: 0, remainingDays: 0, health: "critical" as const };
  }

  const remainingDuration = expire.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingDuration / DAY_IN_MS));

  if (!manufacture || expire.getTime() <= manufacture.getTime()) {
    if (remainingDuration <= 0) {
      return { percent: 0, remainingDays, health: "critical" as const };
    }
    if (remainingDays <= 3) {
      return { percent: Math.min(100, remainingDays * 10), remainingDays, health: "critical" as const };
    }
    if (remainingDays <= 15) {
      return { percent: Math.min(100, remainingDays * 4), remainingDays, health: "warning" as const };
    }
    return { percent: 100, remainingDays, health: "healthy" as const };
  }

  const totalDuration = expire.getTime() - manufacture.getTime();
  const rawPercent = totalDuration > 0 ? (remainingDuration / totalDuration) * 100 : 0;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));

  if (remainingDuration <= 0 || percent < 20) {
    return { percent, remainingDays, health: "critical" as const };
  }
  if (percent <= 50) {
    return { percent, remainingDays, health: "warning" as const };
  }
  return { percent, remainingDays, health: "healthy" as const };
}

function toInventoryHealth(expiryStatus: ExpiryStatus | null | undefined): InventoryHealth | null {
  if (!expiryStatus) {
    return null;
  }
  if (expiryStatus === "normal") {
    return "healthy";
  }
  if (expiryStatus === "warning") {
    return "warning";
  }
  return "critical";
}

function toProgressPercent(progress: number | null | undefined) {
  if (progress === undefined || progress === null || Number.isNaN(progress)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

export function getShelfLifeMetricsFromBatch(batch: Pick<BatchDto, "expire_date" | "manufacture_date" | "days_until_expiry" | "expiry_progress" | "expiry_status">) {
  const fallback = getShelfLifeMetricsFromDates(batch.expire_date, batch.manufacture_date);
  const health = toInventoryHealth(batch.expiry_status) ?? fallback.health;
  const percent = toProgressPercent(batch.expiry_progress) ?? fallback.percent;
  const remainingDays = batch.days_until_expiry ?? fallback.remainingDays;

  return { percent, remainingDays, health };
}

export function getTemperatureMeta(location: string | null) {
  if (location?.includes("冻")) {
    return { value: "-18°C", subValue: "冷冻", colorClassName: "bg-blue-50 text-blue-600" };
  }
  if (location?.includes("冷")) {
    return { value: "4°C", subValue: "冷藏", colorClassName: "bg-blue-50 text-blue-600" };
  }
  return { value: "22°C", subValue: "常温", colorClassName: "bg-amber-50 text-amber-600" };
}

export function toInventoryRecord(batch: BatchDto): InventoryRecord {
  return {
    id: String(batch.id),
    quantity: batch.quantity,
    manufacturer: batch.product.manufacturer,
    productId: batch.product_id,
    productName: batch.product.product_name,
    barcode: batch.product.barcode,
    category: "",
    location: "",
    manufactureDate: batch.manufacture_date ?? batch.received_at,
    expireDate: batch.expire_date ?? batch.received_at,
    receivedDate: batch.received_at,
    status: batch.status,
    batchCode: batch.batch_code,
    remarks: batch.remarks,
    daysUntilExpiry: batch.days_until_expiry,
    expiryProgress: batch.expiry_progress,
    expiryStatus: batch.expiry_status ?? null,
  };
}

export function mergeInventoryRecord(record: InventoryRecord, product?: Product | null): InventoryRecord {
  return {
    ...record,
    category: product?.category ?? record.category ?? "未分类",
    location: product?.location ?? record.location ?? "未分配库位",
  };
}

export function toInventoryRelatedBatch(batch: BatchDto): InventoryRelatedBatch {
  const metrics = getShelfLifeMetricsFromBatch(batch);
  return {
    id: batch.batch_code,
    quantity: parseQuantity(batch.quantity),
    manufactureDate: batch.manufacture_date ?? batch.received_at,
    expireDate: batch.expire_date ?? batch.received_at,
    progress: metrics.percent,
    remainingDays: metrics.remainingDays,
    health: metrics.health,
  };
}

export function buildInventoryDetail(product: Product | null | undefined, batches: BatchDto[]): InventoryBatchDetail {
  const primaryBatch = batches[0];
  const relatedBatches = batches.map(toInventoryRelatedBatch);
  const totalQuantity = relatedBatches.reduce((sum, batch) => sum + batch.quantity, 0);
  const riskyCount = relatedBatches.filter((batch) => batch.health !== "healthy").length;
  const averageLossRate = relatedBatches.length ? ((riskyCount / relatedBatches.length) * 100).toFixed(1) : "0.0";
  const temperatureMeta = getTemperatureMeta(product?.location ?? null);

  return {
    sku: product?.barcode || primaryBatch?.product.barcode || `PRODUCT-${product?.id ?? "UNKNOWN"}`,
    currentStock: totalQuantity,
    averageLossRate,
    batchCount: relatedBatches.length,
    primaryBatchId: primaryBatch?.batch_code ?? "-",
    storageRequirements: [
      {
        label: "目标温度",
        value: temperatureMeta.value,
        subValue: temperatureMeta.subValue,
        icon: "temperature",
        colorClassName: temperatureMeta.colorClassName,
      },
      {
        label: "目标湿度",
        value: "70%",
        subValue: "默认",
        icon: "humidity",
        colorClassName: "bg-cyan-50 text-cyan-600",
      },
    ],
    relatedBatches,
  };
}
