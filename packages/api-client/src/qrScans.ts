import type { ApiClient } from "./client";
import { defaultApiClient } from "./client";

export type QrScanSource = "web_camera" | "mobile_camera" | "handheld";
export type QrScanStatus = "valid" | "near_expiry" | "expired" | "invalid" | "revoked" | "not_found";

export interface QrScanInput {
  qr: string;
  source?: QrScanSource | null;
  deviceId?: string | null;
  clientScanId?: string | null;
  scannedAt?: string | null;
}

export interface QrScanResultDto {
  auditId: string;
  batchCode: string | null;
  productName: string | null;
  status: QrScanStatus;
  message: string;
  expireDate: string | null;
  remainingDays: number | null;
  clientScanId?: string | null;
}

export interface QrScanBulkInput {
  items: QrScanInput[];
}

export interface QrScanBulkResultDto {
  items: QrScanResultDto[];
}

export interface QrScanAuditItemDto extends QrScanResultDto {
  scannedAt: string;
  scannerUser: string | null;
}

export interface QrScanListParams {
  days?: 1 | 7;
}

export interface QrScanAuditListDto {
  items: QrScanAuditItemDto[];
}

export function createClientScanId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createQrScan(input: QrScanInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<QrScanResultDto>("/qr-scans", {
    method: "POST",
    body: {
      qr: input.qr,
      source: input.source ?? null,
      deviceId: input.deviceId ?? null,
      clientScanId: input.clientScanId ?? null,
      scannedAt: input.scannedAt ?? null,
    },
  });
}

export async function createQrScanBulk(input: QrScanBulkInput, client: ApiClient = defaultApiClient) {
  return client.requestJson<QrScanBulkResultDto>("/qr-scans/bulk", {
    method: "POST",
    body: {
      items: input.items.map((item) => ({
        qr: item.qr,
        source: item.source ?? null,
        deviceId: item.deviceId ?? null,
        clientScanId: item.clientScanId ?? null,
        scannedAt: item.scannedAt ?? null,
      })),
    },
  });
}

export async function listQrScans(params: QrScanListParams = {}, client: ApiClient = defaultApiClient) {
  const searchParams = new URLSearchParams();
  if (params.days) {
    searchParams.set("days", String(params.days));
  }
  const query = searchParams.toString();
  return client.requestJson<QrScanAuditListDto>(`/qr-scans${query ? `?${query}` : ""}`);
}
