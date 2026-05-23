import QRCodeModule from "qrcode";

export type LabelPrinterProtocol = "tspl" | "zpl" | "escpos" | "browser";
export type LabelPrinterTransport = "webusb" | "webserial" | "browser";

export interface LabelPrintPayload {
  productName: string;
  barcode: string;
  batchCode: string;
  quantity: string;
  category: string;
  location: string;
  manufacturer: string;
  manufactureDate: string;
  expireDate: string;
  receivedDate: string;
  statusLabel: string;
  qrCode: string;
}

export interface LabelPrinterOptions {
  protocol: LabelPrinterProtocol;
  transport: LabelPrinterTransport;
  copies: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapMm: number;
  density: number;
  baudRate: number;
}

export interface LabelPrintResult {
  transport: LabelPrinterTransport;
  protocol: LabelPrinterProtocol;
  bytes?: number;
}

const MM_TO_DOTS_203_DPI = 8;

interface QrCodeGenerator {
  toDataURL(text: string, options?: { errorCorrectionLevel?: string; margin?: number; width?: number }): Promise<string>;
}

interface UsbNavigator {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>;
}

export const DEFAULT_LABEL_PRINTER_OPTIONS: LabelPrinterOptions = {
  protocol: "tspl",
  transport: "webusb",
  copies: 1,
  labelWidthMm: 60,
  labelHeightMm: 40,
  gapMm: 2,
  density: 8,
  baudRate: 9600,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function text(value: string | null | undefined, fallback = "-") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function escapeTspl(value: string) {
  return value.replace(/"/g, "'");
}

function escapeZpl(value: string) {
  return value.replace(/\^/g, " ").replace(/~/g, " ");
}

export function formatPrintTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function buildLabelQrDataUrl(qrCode: string, width = 360) {
  const candidate = QRCodeModule as unknown as QrCodeGenerator & { default?: QrCodeGenerator };
  const generator = typeof candidate.toDataURL === "function" ? candidate : candidate.default;

  if (!generator?.toDataURL) {
    throw new Error("二维码生成模块不可用。");
  }

  return generator.toDataURL(text(qrCode), {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
  });
}

export function getLabelValueFontSize(value: string, basePt = 7.6, minPt = 5.2) {
  const length = Array.from(text(value)).reduce((sum, char) => sum + (/[\u4e00-\u9fff]/.test(char) ? 1.7 : 1), 0);

  if (length <= 12) {
    return basePt;
  }

  return Math.max(minPt, Number((basePt - (length - 12) * 0.28).toFixed(2)));
}

export function getLabelTitleFontSize(value: string, basePt = 14, minPt = 7.2) {
  const length = Array.from(text(value)).reduce((sum, char) => sum + (/[\u4e00-\u9fff]/.test(char) ? 1.8 : 1), 0);

  if (length <= 8) {
    return basePt;
  }

  return Math.max(minPt, Number((basePt - (length - 8) * 0.55).toFixed(2)));
}

function mmToDots(value: number) {
  return Math.round(value * MM_TO_DOTS_203_DPI);
}

function encode(command: string) {
  return new TextEncoder().encode(command);
}

function assertQrCode(payload: LabelPrintPayload) {
  if (!payload.qrCode.trim()) {
    throw new Error("二维码凭证未加载，不能发送打印命令。");
  }
}

function concatBytes(chunks: Array<Uint8Array | number[]>) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function buildTsplCommand(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  const copies = clamp(Math.floor(options.copies), 1, 99);
  const density = clamp(Math.floor(options.density), 1, 15);
  const printTime = formatPrintTimestamp();
  const landscape = options.labelWidthMm >= options.labelHeightMm;
  const layoutRows = landscape
    ? [
        "BOX 12,12,468,308,3",
        `TEXT 28,30,"TSS24.BF2",0,1,1,"${escapeTspl(text(payload.productName))}"`,
        "BAR 24,70,432,3",
        `QRCODE 34,92,L,5,A,0,"${escapeTspl(text(payload.qrCode))}"`,
        "BAR 196,88,3,190",
        `TEXT 220,90,"TSS24.BF2",0,1,1,"存储位置: ${escapeTspl(text(payload.location))}"`,
        "BAR 210,128,236,3",
        `TEXT 220,144,"TSS24.BF2",0,1,1,"生产日期: ${escapeTspl(text(payload.manufactureDate))}"`,
        "BAR 210,182,236,3",
        `TEXT 220,198,"TSS24.BF2",0,1,1,"到期日期: ${escapeTspl(text(payload.expireDate))}"`,
        "BAR 210,236,236,3",
        `TEXT 220,252,"TSS24.BF2",0,1,1,"打印: ${escapeTspl(printTime)}"`,
      ]
    : [
        "BOX 12,12,308,468,3",
        `TEXT 28,34,"TSS24.BF2",0,1,1,"${escapeTspl(text(payload.productName))}"`,
        "BAR 24,76,272,3",
        `QRCODE 72,98,L,5,A,0,"${escapeTspl(text(payload.qrCode))}"`,
        "BAR 24,260,272,3",
        `TEXT 28,278,"TSS24.BF2",0,1,1,"存储位置: ${escapeTspl(text(payload.location))}"`,
        "BAR 24,320,272,3",
        `TEXT 28,338,"TSS24.BF2",0,1,1,"生产日期: ${escapeTspl(text(payload.manufactureDate))}"`,
        "BAR 24,380,272,3",
        `TEXT 28,398,"TSS24.BF2",0,1,1,"到期日期: ${escapeTspl(text(payload.expireDate))}"`,
        "BAR 24,440,272,3",
        `TEXT 28,456,"TSS24.BF2",0,1,1,"打印: ${escapeTspl(printTime)}"`,
      ];
  const rows = [
    `SIZE ${options.labelWidthMm} mm,${options.labelHeightMm} mm`,
    `GAP ${options.gapMm} mm,0 mm`,
    `DENSITY ${density}`,
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    ...layoutRows,
    `PRINT ${copies},1`,
  ];

  return `${rows.join("\r\n")}\r\n`;
}

function buildZplCommand(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  const copies = clamp(Math.floor(options.copies), 1, 99);
  const width = mmToDots(options.labelWidthMm);
  const height = mmToDots(options.labelHeightMm);
  const qrValue = escapeZpl(text(payload.qrCode));
  const printTime = formatPrintTimestamp();
  const landscape = options.labelWidthMm >= options.labelHeightMm;
  const layoutRows = landscape
    ? [
        "^FO12,12^GB468,308,3^FS",
        `^FO28,30^A0N,30,30^FD${escapeZpl(text(payload.productName))}^FS`,
        "^FO24,70^GB432,3,3^FS",
        `^FO34,92^BQN,2,5^FDLA,${qrValue}^FS`,
        "^FO196,88^GB3,190,3^FS",
        `^FO220,90^A0N,24,24^FD存储位置: ${escapeZpl(text(payload.location))}^FS`,
        "^FO210,128^GB236,3,3^FS",
        `^FO220,144^A0N,24,24^FD生产日期: ${escapeZpl(text(payload.manufactureDate))}^FS`,
        "^FO210,182^GB236,3,3^FS",
        `^FO220,198^A0N,24,24^FD到期日期: ${escapeZpl(text(payload.expireDate))}^FS`,
        "^FO210,236^GB236,3,3^FS",
        `^FO220,252^A0N,20,20^FD打印: ${escapeZpl(printTime)}^FS`,
      ]
    : [
        "^FO12,12^GB296,456,3^FS",
        `^FO28,32^A0N,30,30^FD${escapeZpl(text(payload.productName))}^FS`,
        "^FO24,76^GB272,3,3^FS",
        `^FO72,98^BQN,2,5^FDLA,${qrValue}^FS`,
        "^FO24,260^GB272,3,3^FS",
        `^FO28,278^A0N,24,24^FD存储位置: ${escapeZpl(text(payload.location))}^FS`,
        "^FO24,320^GB272,3,3^FS",
        `^FO28,338^A0N,24,24^FD生产日期: ${escapeZpl(text(payload.manufactureDate))}^FS`,
        "^FO24,380^GB272,3,3^FS",
        `^FO28,398^A0N,24,24^FD到期日期: ${escapeZpl(text(payload.expireDate))}^FS`,
        "^FO24,440^GB272,3,3^FS",
        `^FO28,456^A0N,20,20^FD打印: ${escapeZpl(printTime)}^FS`,
      ];
  const rows = [
    "^XA",
    "^CI28",
    `^PW${width}`,
    `^LL${height}`,
    ...layoutRows,
    `^PQ${copies}`,
    "^XZ",
  ];

  return rows.join("\n");
}

function buildEscPosQrStoreCommand(value: string) {
  const qrBytes = encode(value);
  const length = qrBytes.length + 3;
  const pL = length % 256;
  const pH = Math.floor(length / 256);

  return concatBytes([[0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30], qrBytes]);
}

function buildEscPosCommand(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  const copies = clamp(Math.floor(options.copies), 1, 99);
  const printTime = formatPrintTimestamp();
  const body = concatBytes([
    [0x1b, 0x40, 0x1b, 0x61, 0x00, 0x1b, 0x21, 0x20],
    encode(`${text(payload.productName)}\n`),
    [0x1b, 0x21, 0x00],
    encode("--------------------------------\n"),
    encode(`存储位置 : ${text(payload.location)}\n`),
    encode(`生产日期 : ${text(payload.manufactureDate)}\n`),
    encode(`到期日期 : ${text(payload.expireDate)}\n`),
    encode(`打印时间 : ${printTime}\n\n`),
    [0x1b, 0x61, 0x01],
    [0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00],
    [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06],
    [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31],
    buildEscPosQrStoreCommand(text(payload.qrCode)),
    [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30],
    [0x0a, 0x0a, 0x1d, 0x56, 0x00],
  ]);

  return concatBytes(Array.from({ length: copies }, () => body));
}

export function buildLabelPrintCommand(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  assertQrCode(payload);

  if (options.protocol === "zpl") {
    return encode(buildZplCommand(payload, options));
  }

  if (options.protocol === "escpos") {
    return buildEscPosCommand(payload, options);
  }

  return encode(buildTsplCommand(payload, options));
}

export async function buildBrowserLabelHtml(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  assertQrCode(payload);

  const qrCodeDataUrl = await buildLabelQrDataUrl(payload.qrCode, 360);
  const printTime = formatPrintTimestamp();
  const safe = (value: string) =>
    text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const infoRows = [
    { label: "存储位置", value: text(payload.location), fontSize: getLabelValueFontSize(text(payload.location)) },
    { label: "生产日期", value: text(payload.manufactureDate), fontSize: getLabelValueFontSize(text(payload.manufactureDate)) },
    { label: "到期日期", value: text(payload.expireDate), fontSize: getLabelValueFontSize(text(payload.expireDate)) },
    { label: "打印时间", value: printTime, fontSize: getLabelValueFontSize(printTime, 7.1, 4.9) },
  ];
  const titleFontSize = getLabelTitleFontSize(payload.productName);
  const landscape = options.labelWidthMm >= options.labelHeightMm;
  const labelPadding = landscape ? "2.4mm" : "3mm";
  const framePadding = landscape ? "2.1mm 2.4mm" : "2.4mm";
  const frameRows = landscape ? "8mm 0.6mm minmax(0, 1fr)" : "auto 0.7mm 22mm minmax(0, 1fr)";
  const frameGap = landscape ? "1.6mm" : "1.7mm";
  const titleLineHeight = landscape ? "0.6mm" : "0.7mm";
  const titleSize = landscape ? Math.min(titleFontSize, 13.5) : titleFontSize;
  const contentCss = landscape
    ? ".content { display: grid; grid-template-columns: 20mm 0.6mm minmax(0, 1fr); column-gap: 1.8mm; min-height: 0; }"
    : ".content { display: contents; }";
  const qrCss = landscape
    ? ".qr { width: 19mm; height: 19mm; object-fit: contain; align-self: center; justify-self: center; image-rendering: pixelated; }"
    : ".qr { width: 21mm; height: 21mm; object-fit: contain; align-self: center; justify-self: center; image-rendering: pixelated; }";
  const dividerCss = landscape ? ".divider { width: 0.6mm; background: #000; min-height: 20mm; }" : ".divider { display: none; }";
  const rowCss = landscape
    ? ".row { display: grid; grid-template-columns: 12mm 2mm minmax(0, 1fr); align-items: center; gap: 0.45mm; border-bottom: 0.42mm solid #000; min-height: 4.4mm; padding: 0.25mm 0; }"
    : ".row { display: grid; grid-template-columns: 12mm 2mm minmax(0, 1fr); align-items: center; gap: 0.5mm; border-bottom: 0.45mm solid #000; min-height: 4.8mm; padding: 0.45mm 0; }";
  const labelTextSize = landscape ? "7.1pt" : "7.8pt";
  const colonSize = landscape ? "7.3pt" : "8pt";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>标签打印</title>
  <style>
    @page { size: ${options.labelWidthMm}mm ${options.labelHeightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #000; }
    .label {
      width: ${options.labelWidthMm}mm;
      height: ${options.labelHeightMm}mm;
      padding: ${labelPadding};
      display: flex;
      flex-direction: column;
      page-break-after: always;
    }
    .frame {
      width: 100%;
      height: 100%;
      border: 0.65mm solid #000;
      border-radius: 2.5mm;
      padding: ${framePadding};
      display: grid;
      grid-template-rows: ${frameRows};
      row-gap: ${frameGap};
      overflow: hidden;
    }
    h1 { margin: 0; font-size: ${titleSize}pt; line-height: 1; font-weight: 900; letter-spacing: 0; white-space: nowrap; overflow: hidden; }
    .title-line { height: ${titleLineHeight}; background: #000; }
    ${contentCss}
    ${qrCss}
    ${dividerCss}
    .info { display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)); min-width: 0; min-height: 0; }
    ${rowCss}
    .row:last-child { border-bottom: 0; }
    .label-text { font-size: ${labelTextSize}; font-weight: 900; white-space: nowrap; }
    .colon { font-size: ${colonSize}; font-weight: 900; text-align: center; }
    .value { line-height: 1; font-weight: 900; min-width: 0; white-space: nowrap; overflow: hidden; letter-spacing: 0; }
  </style>
</head>
<body>
  ${Array.from({ length: clamp(Math.floor(options.copies), 1, 99) })
    .map(
      () => `<section class="label">
        <div class="frame">
          <h1>${safe(payload.productName)}</h1>
          <div class="title-line"></div>
          <div class="content">
            <img class="qr" src="${qrCodeDataUrl}" alt="二维码凭证" />
            <div class="divider"></div>
            <div class="info">
              ${infoRows
                .map(
                  (row) => `<div class="row">
                    <div class="label-text">${safe(row.label)}</div>
                    <div class="colon">:</div>
                    <div class="value" style="font-size:${row.fontSize}pt">${safe(row.value)}</div>
                  </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>`,
    )
    .join("")}
  <script>window.addEventListener("load", () => { window.focus(); window.print(); });</script>
</body>
</html>`;
}

async function printViaBrowser(payload: LabelPrintPayload, options: LabelPrinterOptions) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");

  if (!printWindow) {
    throw new Error("浏览器阻止了打印窗口，请允许弹窗后重试。");
  }

  printWindow.document.open();
  printWindow.document.write(await buildBrowserLabelHtml(payload, options));
  printWindow.document.close();
}

async function printViaSerial(command: Uint8Array, options: LabelPrinterOptions) {
  if (!("serial" in navigator)) {
    throw new Error("当前浏览器不支持 Web Serial，请使用 Chromium 系浏览器或选择浏览器打印。");
  }

  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: options.baudRate });

  try {
    const writer = port.writable?.getWriter();
    if (!writer) {
      throw new Error("串口不可写，请检查打印机连接。");
    }

    try {
      await writer.write(command);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}

async function printViaUsb(command: Uint8Array) {
  if (!("usb" in navigator)) {
    throw new Error("当前浏览器不支持 WebUSB，请使用 Chromium 系浏览器或选择浏览器打印。");
  }

  const usb = navigator.usb as UsbNavigator;
  const device = await usb.requestDevice({ filters: [] });
  await device.open();

  try {
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const configuration = device.configuration;
    const candidate = configuration?.interfaces
      .flatMap((usbInterface) =>
        usbInterface.alternates.map((alternate) => ({
          interfaceNumber: usbInterface.interfaceNumber,
          alternateSetting: alternate.alternateSetting,
          endpoint: alternate.endpoints.find((endpoint) => endpoint.direction === "out" && endpoint.type === "bulk"),
        })),
      )
      .find((entry) => entry.endpoint);

    if (!candidate?.endpoint) {
      throw new Error("未找到可写入的 USB bulk out 端点。");
    }

    await device.claimInterface(candidate.interfaceNumber);

    if (candidate.alternateSetting !== 0) {
      await device.selectAlternateInterface(candidate.interfaceNumber, candidate.alternateSetting);
    }

    try {
      await device.transferOut(candidate.endpoint.endpointNumber, command);
    } finally {
      await device.releaseInterface(candidate.interfaceNumber);
    }
  } finally {
    await device.close();
  }
}

export async function sendLabelPrintCommand(payload: LabelPrintPayload, options: LabelPrinterOptions): Promise<LabelPrintResult> {
  if (options.transport === "browser" || options.protocol === "browser") {
    await printViaBrowser(payload, options);
    return { transport: "browser", protocol: "browser" };
  }

  const command = buildLabelPrintCommand(payload, options);

  if (options.transport === "webserial") {
    await printViaSerial(command, options);
  } else {
    await printViaUsb(command);
  }

  return {
    transport: options.transport,
    protocol: options.protocol,
    bytes: command.byteLength,
  };
}
