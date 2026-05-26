import type { BatchDto, ExpiryStatus } from "./batches";
import type { InventoryHealth, ShelfLifeMetrics } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null, options: { endOfDay?: boolean } = {}) {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${options.endOfDay ? "23:59:00" : "00:00:00"}`);
  }
  return new Date(value);
}

export function parseQuantity(quantity: string) {
  return Number.parseFloat(quantity) || 0;
}

export function getShelfLifeMetricsFromDates(expireDate: string | null, manufactureDate: string | null): ShelfLifeMetrics {
  const now = new Date();
  const expire = parseDate(expireDate, { endOfDay: true });
  const manufacture = parseDate(manufactureDate);

  if (!expire) {
    return { percent: 0, remainingDays: 0, health: "critical" };
  }

  const remainingDuration = expire.getTime() - now.getTime();
  const remainingDays =
    remainingDuration < 0
      ? -Math.max(1, Math.ceil(Math.abs(remainingDuration) / DAY_IN_MS))
      : Math.ceil(remainingDuration / DAY_IN_MS);

  if (!manufacture || expire.getTime() <= manufacture.getTime()) {
    if (remainingDuration <= 0) {
      return { percent: 0, remainingDays, health: "critical" };
    }
    if (remainingDays <= 3) {
      return { percent: Math.min(100, remainingDays * 10), remainingDays, health: "critical" };
    }
    if (remainingDays <= 15) {
      return { percent: Math.min(100, remainingDays * 4), remainingDays, health: "warning" };
    }
    return { percent: 100, remainingDays, health: "healthy" };
  }

  const totalDuration = expire.getTime() - manufacture.getTime();
  const rawPercent = totalDuration > 0 ? (remainingDuration / totalDuration) * 100 : 0;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));

  if (remainingDuration <= 0 || percent < 20) {
    return { percent, remainingDays, health: "critical" };
  }
  if (percent <= 50) {
    return { percent, remainingDays, health: "warning" };
  }
  return { percent, remainingDays, health: "healthy" };
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

export function getShelfLifeMetricsFromBatch(
  batch: Pick<BatchDto, "expire_date" | "manufacture_date" | "days_until_expiry" | "expiry_progress" | "expiry_status">,
): ShelfLifeMetrics {
  const fallback = getShelfLifeMetricsFromDates(batch.expire_date, batch.manufacture_date);
  const health = toInventoryHealth(batch.expiry_status) ?? fallback.health;
  const percent = toProgressPercent(batch.expiry_progress) ?? fallback.percent;
  const remainingDays = batch.days_until_expiry ?? fallback.remainingDays;

  return { percent, remainingDays, health };
}
