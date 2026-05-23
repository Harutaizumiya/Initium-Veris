import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_PRINTER_OPTIONS,
  buildBrowserLabelHtml,
  buildLabelQrDataUrl,
  buildLabelPrintCommand,
  type LabelPrintPayload,
} from "./labelPrinter";

const payload: LabelPrintPayload = {
  productName: "鲜奶",
  barcode: "692000000001",
  batchCode: "B202605120001",
  quantity: "12",
  category: "乳制品",
  location: "A-01",
  manufacturer: "Origin Foods",
  manufactureDate: "2026-05-01",
  expireDate: "2026-06-01",
  receivedDate: "2026-05-02",
  statusLabel: "效期健康",
  qrCode: "OB1|B202605120001|N7K3Q9X2P4A8M6D2",
};

function decode(command: Uint8Array) {
  return new TextDecoder().decode(command);
}

describe("label printer QR commands", () => {
  it("uses a landscape 60mm by 40mm label by default", () => {
    expect(DEFAULT_LABEL_PRINTER_OPTIONS.labelWidthMm).toBe(60);
    expect(DEFAULT_LABEL_PRINTER_OPTIONS.labelHeightMm).toBe(40);
  });

  it("generates the preview QR image from the signed qrCode", async () => {
    const dataUrl = await buildLabelQrDataUrl(payload.qrCode, 180);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("includes qrCode in TSPL output", () => {
    const command = decode(buildLabelPrintCommand(payload, { ...DEFAULT_LABEL_PRINTER_OPTIONS, protocol: "tspl" }));

    expect(command).toContain("QRCODE");
    expect(command).toContain(payload.qrCode);
    expect(command).toContain("存储位置");
    expect(command).toContain("打印:");
  });

  it("includes qrCode in ZPL output", () => {
    const command = decode(buildLabelPrintCommand(payload, { ...DEFAULT_LABEL_PRINTER_OPTIONS, protocol: "zpl" }));

    expect(command).toContain("^BQN");
    expect(command).toContain(`LA,${payload.qrCode}`);
    expect(command).toContain("存储位置");
    expect(command).toContain("打印:");
  });

  it("includes ESC/POS QR command bytes", () => {
    const command = buildLabelPrintCommand(payload, { ...DEFAULT_LABEL_PRINTER_OPTIONS, protocol: "escpos" });
    const decoded = decode(command);

    expect(Array.from(command)).toEqual(expect.arrayContaining([0x1d, 0x28, 0x6b]));
    expect(decoded).toContain(payload.qrCode);
  });

  it("renders browser label with a QR image without exposing raw token text", async () => {
    const html = await buildBrowserLabelHtml(payload, { ...DEFAULT_LABEL_PRINTER_OPTIONS, protocol: "browser", transport: "browser" });

    expect(html).toContain("<img class=\"qr\"");
    expect(html).toContain("存储位置");
    expect(html).toContain("打印时间");
    expect(html).toContain("white-space: nowrap");
    expect(html).not.toContain(payload.qrCode);
  });
});
