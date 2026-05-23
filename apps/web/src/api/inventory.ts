import {
  getShelfLifeMetricsFromBatch,
  parseQuantity,
  type BatchDto,
  type Product,
} from "@initium-veris/api-client";
import type { InventoryBatchDetail, InventoryRecord, InventoryRelatedBatch } from "../components/pages/InventoryStatus.types";

export { getShelfLifeMetricsFromBatch, getShelfLifeMetricsFromDates, parseQuantity } from "@initium-veris/api-client";

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
