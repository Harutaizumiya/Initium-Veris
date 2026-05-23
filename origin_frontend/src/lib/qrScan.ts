import type { OperationAlertType } from "../components/common/OperationAlert";
import type { QrScanStatus } from "../api";

export interface QrScanStatusMeta {
  label: string;
  alertType: OperationAlertType;
  badgeClassName: string;
}

export function createClientScanId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getQrScanStatusMeta(status: QrScanStatus): QrScanStatusMeta {
  if (status === "valid") {
    return {
      label: "效期内",
      alertType: "success",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "near_expiry") {
    return {
      label: "临期",
      alertType: "warning",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (status === "expired") {
    return {
      label: "已过期",
      alertType: "error",
      badgeClassName: "border-red-200 bg-red-50 text-red-600",
    };
  }

  if (status === "revoked") {
    return {
      label: "凭证已吊销",
      alertType: "error",
      badgeClassName: "border-red-200 bg-red-50 text-red-600",
    };
  }

  if (status === "not_found") {
    return {
      label: "批次不存在",
      alertType: "error",
      badgeClassName: "border-red-200 bg-red-50 text-red-600",
    };
  }

  return {
    label: "无法识别",
    alertType: "error",
    badgeClassName: "border-red-200 bg-red-50 text-red-600",
  };
}
