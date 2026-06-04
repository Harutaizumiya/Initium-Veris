import type { BatchListParams, BatchOperationListParams } from "./batches";
import type { ProductListParams } from "./products";
import type { QrScanListParams } from "./qrScans";
import type { StocktakeListParams } from "./stocktakes";

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    overview: () => [...queryKeys.dashboard.all, "overview"] as const,
    data: () => [...queryKeys.dashboard.all, "data"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    summary: (range = "6m") => [...queryKeys.analytics.all, "summary", range] as const,
  },
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (params: ProductListParams = {}) => [...queryKeys.products.lists(), params] as const,
    categories: () => [...queryKeys.products.all, "categories"] as const,
  },
  batches: {
    all: ["batches"] as const,
    lists: () => [...queryKeys.batches.all, "list"] as const,
    list: (params: BatchListParams = {}) => [...queryKeys.batches.lists(), params] as const,
    product: (productId: number) => [...queryKeys.batches.all, "product", productId] as const,
    byProduct: (productId: number, params: Omit<BatchListParams, "product_id"> = {}) =>
      [...queryKeys.batches.product(productId), params] as const,
    labelPayload: (batchId: number) => [...queryKeys.batches.all, "label-payload", batchId] as const,
  },
  operations: {
    all: ["batch-operations"] as const,
    batch: (batchId: number) => [...queryKeys.operations.all, "batch", batchId] as const,
    list: (batchId: number, params: BatchOperationListParams = {}) => [...queryKeys.operations.batch(batchId), params] as const,
  },
  qrScans: {
    all: ["qr-scans"] as const,
    list: (params: QrScanListParams = {}) => [...queryKeys.qrScans.all, "list", params] as const,
  },
  stocktakes: {
    all: ["stocktakes"] as const,
    lists: () => [...queryKeys.stocktakes.all, "list"] as const,
    list: (params: StocktakeListParams = {}) => [...queryKeys.stocktakes.lists(), params] as const,
    detail: (taskId: number) => [...queryKeys.stocktakes.all, "detail", taskId] as const,
    auditLogs: (taskId: number) => [...queryKeys.stocktakes.all, "audit-logs", taskId] as const,
  },
  authManagement: {
    all: ["auth-management"] as const,
    permissions: () => [...queryKeys.authManagement.all, "permissions"] as const,
    roles: () => [...queryKeys.authManagement.all, "roles"] as const,
    users: () => [...queryKeys.authManagement.all, "users"] as const,
  },
};
