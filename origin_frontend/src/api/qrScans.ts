import { requestJson } from "./client";
import { logger } from "../lib/logger";

export type QrScanSource = "web_camera" | "mobile_camera" | "handheld";
export type QrScanStatus = "valid" | "near_expiry" | "expired" | "invalid" | "revoked" | "not_found";

export interface QrScanInput {
  qr: string;
  source: QrScanSource;
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

export async function createQrScan(input: QrScanInput) {
  try {
    const result = await requestJson<QrScanResultDto>("/qr-scans", {
      method: "POST",
      body: {
        qr: input.qr,
        source: input.source,
        deviceId: input.deviceId ?? null,
        clientScanId: input.clientScanId ?? null,
        scannedAt: input.scannedAt ?? null,
      },
    });
    logger.info("qr.scan", "QR scan submitted", {
      event: "qr_scan_submitted",
      source: input.source,
      deviceId: input.deviceId ?? null,
      clientScanId: input.clientScanId ?? null,
      status: result.status,
      batchCode: result.batchCode,
      auditId: result.auditId,
    });
    return result;
  } catch (error) {
    logger.error("qr.scan", "QR scan submission failed", {
      event: "qr_scan_failed",
      source: input.source,
      deviceId: input.deviceId ?? null,
      clientScanId: input.clientScanId ?? null,
      error,
    });
    throw error;
  }
}

export async function createQrScanBulk(input: QrScanBulkInput) {
  try {
    const result = await requestJson<QrScanBulkResultDto>("/qr-scans/bulk", {
      method: "POST",
      body: {
        items: input.items.map((item) => ({
          qr: item.qr,
          source: item.source,
          deviceId: item.deviceId ?? null,
          clientScanId: item.clientScanId ?? null,
          scannedAt: item.scannedAt ?? null,
        })),
      },
    });
    logger.info("qr.scan", "Bulk QR scans submitted", {
      event: "qr_scan_bulk_submitted",
      count: input.items.length,
      statuses: result.items.map((item) => item.status),
    });
    return result;
  } catch (error) {
    logger.error("qr.scan", "Bulk QR scan submission failed", {
      event: "qr_scan_bulk_failed",
      count: input.items.length,
      error,
    });
    throw error;
  }
}
