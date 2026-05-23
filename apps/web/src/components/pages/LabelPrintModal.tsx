import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cable, LoaderCircle, MonitorUp, Printer, Usb, X } from "lucide-react";
import {
  DEFAULT_LABEL_PRINTER_OPTIONS,
  buildLabelQrDataUrl,
  formatPrintTimestamp,
  getLabelTitleFontSize,
  getLabelValueFontSize,
  sendLabelPrintCommand,
  type LabelPrintPayload,
  type LabelPrinterOptions,
  type LabelPrinterProtocol,
  type LabelPrinterTransport,
} from "../../lib/labelPrinter";
import { cn } from "../../lib/utils";
import { getErrorDebugDetail, OperationFeedbackToast, type OperationFeedbackState } from "../common/OperationFeedbackToast";

interface LabelPrintModalProps {
  open: boolean;
  payload: LabelPrintPayload | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

const PROTOCOL_OPTIONS: Array<{ value: LabelPrinterProtocol; label: string; hint: string }> = [
  { value: "tspl", label: "TSPL", hint: "TSC、佳博等标签机常用" },
  { value: "zpl", label: "ZPL", hint: "Zebra 兼容标签机常用" },
  { value: "escpos", label: "ESC/POS", hint: "票据机和部分标签机兼容" },
  { value: "browser", label: "浏览器", hint: "系统打印对话框兜底" },
];

const TRANSPORT_OPTIONS: Array<{ value: LabelPrinterTransport; label: string; icon: React.ReactNode; hint: string }> = [
  { value: "webusb", label: "WebUSB", icon: <Usb size={16} />, hint: "USB 直连，浏览器会请求选择设备" },
  { value: "webserial", label: "WebSerial", icon: <Cable size={16} />, hint: "串口/USB 转串口，适合工业设备" },
  { value: "browser", label: "浏览器打印", icon: <MonitorUp size={16} />, hint: "不发原始指令，由系统驱动处理" },
];

const LabelPreview: React.FC<{
  payload: LabelPrintPayload;
  qrDataUrl: string | null;
  qrLoading: boolean;
  qrError: string | null;
  printTime: string;
  options: LabelPrinterOptions;
}> = ({ payload, qrDataUrl, qrLoading, qrError, printTime, options }) => {
  const rows = [
    { label: "存储位置", value: payload.location, fontSize: getLabelValueFontSize(payload.location) },
    { label: "生产日期", value: payload.manufactureDate, fontSize: getLabelValueFontSize(payload.manufactureDate) },
    { label: "到期日期", value: payload.expireDate, fontSize: getLabelValueFontSize(payload.expireDate) },
    { label: "打印时间", value: printTime, fontSize: getLabelValueFontSize(printTime, 7.1, 4.9) },
  ];
  const titleFontSize = getLabelTitleFontSize(payload.productName);
  const landscape = options.labelWidthMm >= options.labelHeightMm;
  const previewWidth = landscape ? 560 : 320;
  const previewAspectRatio = `${options.labelWidthMm} / ${options.labelHeightMm}`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
      <div
        className="mx-auto bg-white p-[18px] text-black shadow-sm"
        style={{
          width: `${previewWidth}px`,
          maxWidth: "100%",
          aspectRatio: previewAspectRatio,
        }}
      >
        <div
          className={cn(
            "grid h-full overflow-hidden rounded-[18px] border-[5px] border-black px-[18px] py-[18px]",
            landscape ? "grid-rows-[auto_5px_minmax(0,1fr)] gap-y-[12px]" : "grid-rows-[auto_5px_168px_minmax(0,1fr)] gap-y-[14px]",
          )}
        >
          <h4
            className="overflow-hidden whitespace-nowrap font-black leading-none tracking-normal"
            style={{ fontSize: `${titleFontSize * (landscape ? 2.35 : 3.55)}px` }}
          >
            {payload.productName}
          </h4>
          <div className="h-[5px] bg-black" />
          <div
            className={cn(
              "grid min-h-0 min-w-0",
              landscape ? "grid-cols-[150px_5px_minmax(0,1fr)] gap-x-[18px]" : "grid-rows-[168px_minmax(0,1fr)] gap-y-[14px]",
            )}
          >
            <div className="flex min-h-0 items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="二维码凭证预览"
                  className={cn("object-contain [image-rendering:pixelated]", landscape ? "h-[150px] w-[150px]" : "h-[168px] w-[168px]")}
                />
              ) : qrLoading ? (
                <div
                  className={cn(
                    "flex items-center justify-center border-4 border-black px-2 text-center text-xs font-black",
                    landscape ? "h-[150px] w-[150px]" : "h-[168px] w-[168px]",
                  )}
                >
                  生成中
                </div>
              ) : qrError ? (
                <div
                  className={cn(
                    "flex items-center justify-center border-4 border-black px-2 text-center text-xs font-black",
                    landscape ? "h-[150px] w-[150px]" : "h-[168px] w-[168px]",
                  )}
                >
                  二维码生成失败
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-center border-4 border-black text-sm font-black",
                    landscape ? "h-[150px] w-[150px]" : "h-[168px] w-[168px]",
                  )}
                >
                  QR
                </div>
              )}
            </div>
            {landscape ? <div className="h-full w-[5px] bg-black" /> : null}
            <div className="grid min-w-0 grid-rows-4">
              {rows.map(({ label, value, fontSize }, index) => (
                <div
                  key={label}
                  className={cn(
                    "grid min-h-0 items-center gap-x-[4px]",
                    landscape ? "grid-cols-[80px_14px_minmax(0,1fr)] py-[2px]" : "grid-cols-[96px_16px_minmax(0,1fr)] py-[3px]",
                    index < rows.length - 1 ? "border-b-[3px] border-black" : "",
                  )}
                >
                  <div className={cn("whitespace-nowrap font-black", landscape ? "text-[18px]" : "text-[20px]")}>{label}</div>
                  <div className={cn("text-center font-black", landscape ? "text-[18px]" : "text-[20px]")}>:</div>
                  <div
                    className="min-w-0 overflow-hidden whitespace-nowrap font-black leading-none"
                    style={{ fontSize: `${fontSize * (landscape ? 2.25 : 2.62)}px` }}
                  >
                    {value || "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ open, payload, loading = false, error = null, onClose, onRetry }) => {
  const [options, setOptions] = useState<LabelPrinterOptions>(DEFAULT_LABEL_PRINTER_OPTIONS);
  const [printing, setPrinting] = useState(false);
  const [feedback, setFeedback] = useState<OperationFeedbackState | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string | null>(null);
  const [previewQrLoading, setPreviewQrLoading] = useState(false);
  const [previewQrError, setPreviewQrError] = useState<string | null>(null);
  const [previewPrintTime, setPreviewPrintTime] = useState(() => formatPrintTimestamp());
  const canPrint = Boolean(payload?.qrCode.trim()) && !loading && !error;

  const effectiveOptions = useMemo<LabelPrinterOptions>(() => {
    if (options.transport === "browser") {
      return { ...options, protocol: "browser" };
    }

    if (options.protocol === "browser") {
      return { ...options, transport: "browser" };
    }

    return options;
  }, [options]);

  const updateOption = useCallback(<Key extends keyof LabelPrinterOptions>(key: Key, value: LabelPrinterOptions[Key]) => {
    setOptions((currentOptions) => ({ ...currentOptions, [key]: value }));
    setFeedback(null);
  }, []);

  useEffect(() => {
    let active = true;

    if (!payload?.qrCode.trim()) {
      setPreviewQrDataUrl(null);
      setPreviewQrLoading(false);
      setPreviewQrError(null);
      return;
    }

    setPreviewPrintTime(formatPrintTimestamp());
    setPreviewQrDataUrl(null);
    setPreviewQrLoading(true);
    setPreviewQrError(null);
    buildLabelQrDataUrl(payload.qrCode, 360)
      .then((dataUrl) => {
        if (active) {
          setPreviewQrDataUrl(dataUrl);
          setPreviewQrError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPreviewQrDataUrl(null);
          setPreviewQrError(error instanceof Error ? error.message : "二维码生成失败。");
        }
      })
      .finally(() => {
        if (active) {
          setPreviewQrLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [payload?.qrCode]);

  const handlePrint = useCallback(async () => {
    if (!payload?.qrCode.trim()) {
      setFeedback({
        type: "error",
        title: "打印失败",
        description: "二维码凭证未加载，不能发送打印命令。",
      });
      setFeedbackOpen(true);
      return;
    }

    setPrinting(true);
    setFeedback(null);

    try {
      const result = await sendLabelPrintCommand(payload, effectiveOptions);
      setFeedback({
        type: "success",
        title: "打印命令已发送",
        description: result.bytes ? `打印命令已发送，写入 ${result.bytes} bytes。` : "已打开系统打印流程。",
      });
      setFeedbackOpen(true);
    } catch (error) {
      setFeedback({
        type: "error",
        title: "打印失败",
        description: "打印失败，请检查打印机连接。",
        debugDetail: getErrorDebugDetail(error),
      });
      setFeedbackOpen(true);
    } finally {
      setPrinting(false);
    }
  }, [effectiveOptions, payload]);

  return (
    <>
      <OperationFeedbackToast open={feedbackOpen} feedback={feedback} onClose={() => setFeedbackOpen(false)} />
      <AnimatePresence>
        {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-[3px]"
            onClick={printing ? undefined : onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.section
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="ambient-shadow pointer-events-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between border-b border-surface-container-high px-8 py-6">
                <div>
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">打印标签</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">发送热敏标签打印命令，支持常见原始协议和系统打印兜底。</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={printing}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">协议</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PROTOCOL_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateOption("protocol", option.value)}
                          className={cn(
                            "min-h-[78px] rounded-2xl border px-4 py-3 text-left transition-all",
                            effectiveOptions.protocol === option.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-slate-200 bg-white text-on-surface hover:border-primary/30",
                          )}
                        >
                          <div className="font-bold">{option.label}</div>
                          <div className="mt-1 text-xs text-on-surface-variant">{option.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">通道</div>
                    <div className="space-y-3">
                      {TRANSPORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateOption("transport", option.value)}
                          className={cn(
                            "flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                            effectiveOptions.transport === option.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-slate-200 bg-white text-on-surface hover:border-primary/30",
                          )}
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">{option.icon}</span>
                          <span>
                            <span className="block font-bold">{option.label}</span>
                            <span className="mt-0.5 block text-xs text-on-surface-variant">{option.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">宽度 mm</span>
                    <input
                      type="number"
                      min={20}
                      max={120}
                      value={effectiveOptions.labelWidthMm}
                      onChange={(event) => updateOption("labelWidthMm", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">高度 mm</span>
                    <input
                      type="number"
                      min={15}
                      max={100}
                      value={effectiveOptions.labelHeightMm}
                      onChange={(event) => updateOption("labelHeightMm", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">间隙 mm</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={effectiveOptions.gapMm}
                      onChange={(event) => updateOption("gapMm", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">浓度</span>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={effectiveOptions.density}
                      onChange={(event) => updateOption("density", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">份数</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={effectiveOptions.copies}
                      onChange={(event) => updateOption("copies", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </section>

                {effectiveOptions.transport === "webserial" ? (
                  <label className="block max-w-xs space-y-2">
                    <span className="text-sm font-semibold text-on-surface">串口波特率</span>
                    <input
                      type="number"
                      min={1200}
                      step={1200}
                      value={effectiveOptions.baudRate}
                      onChange={(event) => updateOption("baudRate", Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                ) : null}

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">标签预览</div>
                  {loading ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-on-surface-variant">
                      <LoaderCircle size={18} className="animate-spin" />
                      正在从后端加载二维码凭证...
                    </div>
                  ) : error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
                      <div className="font-bold">二维码凭证加载失败</div>
                      <div className="mt-1">{error}</div>
                      {onRetry ? (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                        >
                          重新加载
                        </button>
                      ) : null}
                    </div>
                  ) : payload ? (
                    <LabelPreview
                      payload={payload}
                      qrDataUrl={previewQrDataUrl}
                      qrLoading={previewQrLoading}
                      qrError={previewQrError}
                      printTime={previewPrintTime}
                      options={effectiveOptions}
                    />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-on-surface-variant">
                      尚未加载标签数据。
                    </div>
                  )}
                  {effectiveOptions.protocol === "escpos" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                      ESC/POS 二维码指令存在机型差异；若设备不响应，请切换 TSPL、ZPL 或浏览器打印。
                    </div>
                  ) : null}
                </section>

              </div>

              <div className="flex flex-col items-stretch justify-end gap-3 border-t border-surface-container-high bg-white/80 p-6 backdrop-blur-sm sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={printing}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing || !canPrint}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {printing ? <LoaderCircle size={16} className="animate-spin" /> : <Printer size={16} />}
                  发送打印命令
                </button>
              </div>
            </motion.section>
          </div>
        </>
        ) : null}
      </AnimatePresence>
    </>
  );
};
