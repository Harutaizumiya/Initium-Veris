import type { ReactNode } from "react";

export type ExpiryStatus = "expired" | "critical" | "warning" | "normal";
export type InventoryHealth = "healthy" | "warning" | "critical";
export type InventoryStorageIcon = "temperature" | "humidity";

export interface InventoryRecord {
  id: string;
  quantity: string;
  manufacturer: string;
  productId: number;
  productName: string;
  barcode: string;
  category: string;
  location: string;
  manufactureDate: string;
  expireDate: string;
  receivedDate: string;
  status: string | null;
  batchCode: string;
  remarks?: string | null;
  daysUntilExpiry?: number | null;
  expiryProgress?: number | null;
  expiryStatus?: ExpiryStatus | null;
}

export interface ShelfLifeMetrics {
  percent: number;
  remainingDays: number;
  health: InventoryHealth;
}

export interface InventoryHealthMeta {
  label: string;
  hint: string;
  tagClassName: string;
  lineClassName: string;
  icon: ReactNode;
  progress: string;
}

export interface InventoryStorageRequirement {
  label: string;
  value: string;
  subValue: string;
  icon: InventoryStorageIcon;
  colorClassName: string;
}

export interface InventoryRelatedBatch {
  id: string;
  quantity: number;
  manufactureDate: string;
  expireDate: string;
  progress: number;
  remainingDays: number;
  health: InventoryHealth;
}

export interface InventoryBatchDetail {
  sku: string;
  currentStock: number;
  averageLossRate: string;
  batchCount: number;
  primaryBatchId: string;
  storageRequirements: InventoryStorageRequirement[];
  relatedBatches: InventoryRelatedBatch[];
}

export interface InventoryBatchDetailModalProps {
  open: boolean;
  item: InventoryRecord | null;
  detail: InventoryBatchDetail | null;
  metrics: ShelfLifeMetrics | null;
  canPrintLabel: boolean;
  canSubmitLoss: boolean;
  onClose: () => void;
  onPrintLabel: () => void;
  onOpenLossReport: () => void;
  formatDate: (date: string) => string;
  formatDateTime: (date: string) => string;
  formatQuantity: (quantity: string) => string;
}
