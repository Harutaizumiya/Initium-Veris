import "./client";
import { logger } from "../lib/logger";
import {
  createQrScan as createSharedQrScan,
  createQrScanBulk as createSharedQrScanBulk,
  listQrScans as listSharedQrScans,
  type QrScanBulkInput,
  type QrScanInput,
  type QrScanListParams,
} from "@initium-veris/api-client";

export type {
  QrScanAuditItemDto,
  QrScanAuditListDto,
  QrScanBulkInput,
  QrScanBulkResultDto,
  QrScanInput,
  QrScanListParams,
  QrScanResultDto,
  QrScanSource,
  QrScanStatus,
} from "@initium-veris/api-client";

export async function createQrScan(input: QrScanInput) {
  try {
    const result = await createSharedQrScan(input);
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
    const result = await createSharedQrScanBulk(input);
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

export async function listQrScans(params: QrScanListParams = {}) {
  return listSharedQrScans(params);
}
