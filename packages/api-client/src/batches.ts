import type { ApiClient } from "./client";
import { defaultApiClient } from "./client";
import type { ApiListData } from "./types";

export type ExpiryStatus = "expired" | "critical" | "warning" | "normal";

export interface ProductSummaryDto {
  id: number;
  barcode: string;
  product_name: string;
  unit: string | null;
  manufacturer: string;
  shelf_life_days?: number;
}

export interface BatchDto {
  id: number;
  product_id: number;
  batch_code: string;
  quantity: string;
  received_at: string;
  manufacture_date: string | null;
  expire_date: string | null;
  status: string | null;
  remarks: string | null;
  days_until_expiry?: number | null;
  expiry_progress?: number | null;
  expiry_status?: ExpiryStatus;
  product: ProductSummaryDto;
}

export type BatchOperationType = "add" | "deduct" | "loss";

export interface BatchOperationDto {
  id: number;
  batch_id: number;
  operation_type: BatchOperationType;
  quantity: string;
  quantity_after: string;
  remarks: string | null;
  created_at: string;
  reversed_operation_id: number | null;
  is_reverted: boolean;
}

export interface BatchListParams {
  product_id?: number;
  status?: string;
  expired_only?: boolean;
  page?: number;
  size?: number;
}

export interface BatchOperationListParams {
  operation_type?: BatchOperationType;
  page?: number;
  size?: number;
}

export interface BatchMutationInput {
  product_id: number;
  batch_code?: string;
  manufacture_date: string;
  expire_date?: string | null;
  status?: string | null;
  remarks?: string | null;
}

export interface BatchOperationMutationInput {
  operation_type: BatchOperationType;
  quantity: string;
  remarks?: string | null;
}

export interface BatchOperationRevertInput {
  remarks?: string | null;
}

export interface BatchOperationMutationResult {
  operation: BatchOperationDto;
  batch: Pick<BatchDto, "id" | "quantity" | "status">;
}

export interface BatchLabelPayloadDto {
  batchCode: string;
  productName: string;
  barcode: string;
  quantity: string | null;
  location: string | null;
  expireDate: string | null;
  qrCode: string;
}

export function buildBatchQuery(params: BatchListParams | BatchOperationListParams = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function listBatches(params: BatchListParams = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<ApiListData<BatchDto>>(`/batches${buildBatchQuery(params)}`);
}

export async function createBatch(input: BatchMutationInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<BatchDto>("/batches", {
    method: "POST",
    body: {
      product_id: input.product_id,
      ...(input.batch_code ? { batch_code: input.batch_code.trim() } : {}),
      manufacture_date: input.manufacture_date,
      ...(input.expire_date !== undefined ? { expire_date: input.expire_date } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
    },
  });
}

export async function listProductBatches(productId: number, params: Omit<BatchListParams, "product_id"> = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<ApiListData<BatchDto>>(`/products/${productId}/batches${buildBatchQuery(params)}`);
}

export async function listBatchOperations(batchId: number, params: BatchOperationListParams = {}, client: ApiClient = defaultApiClient) {
  return client.requestJson<ApiListData<BatchOperationDto>>(`/batches/${batchId}/operations${buildBatchQuery(params)}`);
}

export async function getBatchLabelPayload(batchId: number, client: ApiClient = defaultApiClient) {
  return client.requestJson<BatchLabelPayloadDto>(`/batches/${batchId}/label-payload`);
}

export async function createBatchOperation(batchId: number, input: BatchOperationMutationInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<BatchOperationMutationResult>(`/batches/${batchId}/operations`, {
    method: "POST",
    body: {
      operation_type: input.operation_type,
      quantity: input.quantity.trim(),
      remarks: input.remarks?.trim() || null,
    },
  });
}

export async function revertBatchOperation(
  batchId: number,
  operationId: number,
  input: BatchOperationRevertInput = {},
  client: ApiClient = defaultApiClient,
) {
  return client.requestJson<BatchOperationMutationResult>(`/batches/${batchId}/operations/${operationId}/revert`, {
    method: "POST",
    body: {
      remarks: input.remarks?.trim() || null,
    },
  });
}
