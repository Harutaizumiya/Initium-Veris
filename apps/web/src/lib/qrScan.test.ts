import { describe, expect, it } from "vitest";
import type { QrScanStatus } from "../api";
import { getQrScanStatusMeta } from "./qrScan";

describe("getQrScanStatusMeta", () => {
  it("maps every scan status to a user-facing label and alert type", () => {
    const statuses: QrScanStatus[] = ["valid", "near_expiry", "expired", "invalid", "revoked", "not_found"];

    expect(statuses.map((status) => getQrScanStatusMeta(status))).toEqual([
      expect.objectContaining({ label: "效期内", alertType: "success" }),
      expect.objectContaining({ label: "临期", alertType: "warning" }),
      expect.objectContaining({ label: "已过期", alertType: "error" }),
      expect.objectContaining({ label: "无法识别", alertType: "error" }),
      expect.objectContaining({ label: "凭证已吊销", alertType: "error" }),
      expect.objectContaining({ label: "批次不存在", alertType: "error" }),
    ]);
  });
});
