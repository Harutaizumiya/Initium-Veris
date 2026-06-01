import type { ApiClient } from "./client";
import { defaultApiClient } from "./client";
import type { ApiListData } from "./types";
import { buildBatchQuery, type BatchDto } from "./batches";

export type StocktakeTaskType = "daily" | "weekly" | "monthly";
export type StocktakeTaskStatus = "draft" | "active" | "submitted" | "approved" | "cancelled";
export type StocktakeItemStatus = "pending" | "counted" | "recount_required" | "approved";

export interface StocktakeUserDto {
  id: number | null;
  username: string | null;
  display: string | null;
}

export interface StocktakeStatsDto {
  total_items: number;
  counted_items: number;
  pending_items: number;
  recount_items: number;
  difference_items: number;
  total_difference_quantity: string;
  progress: number;
}

export interface StocktakeProductDto {
  id: number;
  barcode: string;
  product_name: string;
  category: string | null;
  location: string | null;
  unit: string | null;
  manufacturer: string;
}

export interface StocktakeItemDto {
  id: number;
  task_id: number;
  batch_id: number;
  product_id: number;
  snapshot_quantity: string;
  counted_quantity: string | null;
  difference_quantity: string | null;
  status: StocktakeItemStatus;
  remarks: string | null;
  counted_by: StocktakeUserDto | null;
  counted_at: string | null;
  batch: BatchDto & { product: StocktakeProductDto };
  product: StocktakeProductDto;
}

export interface StocktakeTaskDto {
  id: number;
  task_type: StocktakeTaskType;
  scope_config: Record<string, unknown>;
  status: StocktakeTaskStatus;
  created_by: StocktakeUserDto | null;
  submitted_by: StocktakeUserDto | null;
  approved_by: StocktakeUserDto | null;
  created_at: string;
  started_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  stats: StocktakeStatsDto;
  items: StocktakeItemDto[] | null;
}

export interface StocktakeAuditLogDto {
  id: number;
  task_id: number;
  action: string;
  actor: StocktakeUserDto | null;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface StocktakeListParams {
  task_type?: StocktakeTaskType;
  status?: StocktakeTaskStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  size?: number;
}

export interface StocktakeCreateInput {
  task_type: StocktakeTaskType;
  scope_config?: Record<string, unknown>;
}

export interface StocktakeScopeUpdateInput {
  add_batch_ids?: number[];
  add_product_ids?: number[];
  add_categories?: string[];
  add_locations?: string[];
  add_expiry_statuses?: string[];
  add_recent_changes_days?: number;
  remove_batch_ids?: number[];
  scope_config?: Record<string, unknown>;
}

export interface StocktakeCountInput {
  counted_quantity: string;
  status?: Extract<StocktakeItemStatus, "counted" | "recount_required">;
  remarks?: string | null;
}

export interface StocktakeDecisionInput {
  remarks?: string | null;
}

export async function listStocktakes(params: StocktakeListParams = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<ApiListData<StocktakeTaskDto>>(`/stocktakes${buildBatchQuery(params)}`);
}

export async function createStocktake(input: StocktakeCreateInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>("/stocktakes", {
    method: "POST",
    body: {
      task_type: input.task_type,
      scope_config: input.scope_config ?? {},
    },
  });
}

export async function getStocktake(taskId: number, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}`);
}

export async function updateStocktakeScope(taskId: number, input: StocktakeScopeUpdateInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}/scope`, {
    method: "PATCH",
    body: input,
  });
}

export async function startStocktake(taskId: number, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}/start`, { method: "POST", body: {} });
}

export async function countStocktakeItem(
  taskId: number,
  itemId: number,
  input: StocktakeCountInput,
  client: ApiClient = defaultApiClient,
) {
  return client.requestJson<StocktakeItemDto>(`/stocktakes/${taskId}/items/${itemId}/count`, {
    method: "PATCH",
    body: {
      counted_quantity: input.counted_quantity.trim(),
      status: input.status ?? "counted",
      remarks: input.remarks?.trim() || null,
    },
  });
}

export async function submitStocktake(taskId: number, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}/submit`, { method: "POST", body: {} });
}

export async function approveStocktake(taskId: number, input: StocktakeDecisionInput = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}/approve`, {
    method: "POST",
    body: { remarks: input.remarks?.trim() || null },
  });
}

export async function cancelStocktake(taskId: number, input: StocktakeDecisionInput = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<StocktakeTaskDto>(`/stocktakes/${taskId}/cancel`, {
    method: "POST",
    body: { remarks: input.remarks?.trim() || null },
  });
}

export async function listStocktakeAuditLogs(taskId: number, client: ApiClient = defaultApiClient) {
  return client.requestJson<ApiListData<StocktakeAuditLogDto>>(`/stocktakes/${taskId}/audit-logs`);
}
