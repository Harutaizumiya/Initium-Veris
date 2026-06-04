import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ClipboardPaste, Keyboard, LoaderCircle, QrCode, RotateCcw, ScanLine } from "lucide-react";
import { createQrScan, formatErrorMessage, listQrScans, queryKeys, type QrScanAuditItemDto, type QrScanResultDto } from "../../api";
import { cn } from "../../lib/utils";
import { createClientScanId, getQrScanStatusMeta } from "../../lib/qrScan";
import { useNotification } from "../../providers/NotificationProvider";
import { Pagination } from "../common/Pagination";
import { getErrorDebugDetail } from "../common/OperationFeedbackToast";

type ScanWindowDays = 1 | 7;

const DEFAULT_SCAN_WINDOW_DAYS: ScanWindowDays = 1;
const DEBUG_SCAN_WINDOW_DAYS: ScanWindowDays = 7;
const RECENT_SCAN_PAGE_SIZE = 6;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const QR_SCAN_ERROR_MESSAGE_OPTIONS = {
  fallback: "扫码审计提交失败，请稍后重试。",
  apiClientMessages: {
    validation_error: "二维码提交参数不符合演示数据校验规则。",
    invalid_response: "演示数据返回格式不符合约定。",
  },
};

function getScanWindowLabel(days: ScanWindowDays) {
  return days === DEBUG_SCAN_WINDOW_DAYS ? "最近 7 天" : "今日";
}

export const QrScanPage: React.FC = () => {
  const [qrInput, setQrInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QrScanResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanWindowDays, setScanWindowDays] = useState<ScanWindowDays>(DEFAULT_SCAN_WINDOW_DAYS);
  const [currentPage, setCurrentPage] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const isDebugMode = import.meta.env.DEV;
  const notify = useNotification();

  const scanHistoryQuery = useQuery({
    queryKey: queryKeys.qrScans.list({ days: scanWindowDays }),
    queryFn: () => listQrScans({ days: scanWindowDays }),
  });
  const recentScans = scanHistoryQuery.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(recentScans.length / RECENT_SCAN_PAGE_SIZE));
  const pagedRecentScans = useMemo(() => {
    const startIndex = (currentPage - 1) * RECENT_SCAN_PAGE_SIZE;
    return recentScans.slice(startIndex, startIndex + RECENT_SCAN_PAGE_SIZE);
  }, [currentPage, recentScans]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isDebugMode && scanWindowDays !== DEFAULT_SCAN_WINDOW_DAYS) {
      setScanWindowDays(DEFAULT_SCAN_WINDOW_DAYS);
    }
  }, [scanWindowDays, isDebugMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scanWindowDays]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const resetForm = useCallback(() => {
    setQrInput("");
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const qr = qrInput.trim();
    if (!qr) {
      setError("请输入或扫描二维码。");
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const scanResult = await createQrScan({
        qr,
        clientScanId: createClientScanId(),
        scannedAt: new Date().toISOString(),
      });
      const statusMeta = getQrScanStatusMeta(scanResult.status);
      setResult(scanResult);
      await queryClient.invalidateQueries({ queryKey: queryKeys.qrScans.all });
      notify.notify({
        type: statusMeta.alertType,
        title: "扫码审计已提交",
        description: scanResult.message,
      });
      setQrInput("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (requestError) {
      setError(formatErrorMessage(requestError, QR_SCAN_ERROR_MESSAGE_OPTIONS));
      notify.error({
        title: "扫码审计失败",
        description: formatErrorMessage(requestError, QR_SCAN_ERROR_MESSAGE_OPTIONS),
        debugDetail: getErrorDebugDetail(requestError),
      });
    } finally {
      setSubmitting(false);
    }
  }, [notify, qrInput, queryClient]);

  return (
    <div>
        <div className="mb-8">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">扫码审计</h2>
          </div>
        </div>

        <div>
          <section className="ambient-shadow mb-8 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-5 border-b border-surface-container-high pb-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">审计提交</h3>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                  <ScanLine size={16} />
                  数据来源：前端模拟扫码审计
                </div>
              </div>

              <label className="block space-y-3">
                <span className="text-sm font-semibold text-on-surface">二维码输入</span>
                <div className="relative">
                  <ClipboardPaste size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    ref={inputRef}
                    value={qrInput}
                    onChange={(event) => {
                      setQrInput(event.target.value);
                      setError(null);
                    }}
                    disabled={submitting}
                    className="w-full rounded-2xl border border-slate-200 bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="扫描或粘贴二维码"
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-surface-container-high pt-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  重置
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Keyboard size={16} />}
                  提交审计
                </button>
              </div>
            </form>
          </section>

          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={result.auditId}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="ambient-shadow mb-8 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-headline text-xl font-bold text-on-surface">本次结果</h3>
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", getQrScanStatusMeta(result.status).badgeClassName)}>
                    {getQrScanStatusMeta(result.status).label}
                  </span>
                </div>
                <div className="grid gap-4 text-sm text-on-surface-variant md:grid-cols-2">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">审计 ID</span>
                    <span className="mt-1 block font-mono text-on-surface">{result.auditId}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">批次</span>
                    <span className="mt-1 block font-semibold text-on-surface">{result.batchCode ?? "-"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">货物</span>
                    <span className="mt-1 block font-semibold text-on-surface">{result.productName ?? "-"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">效期信息</span>
                    <span className="mt-1 block font-semibold text-on-surface">
                      {result.expireDate ? formatDate(result.expireDate) : "-"}
                      {result.remainingDays === null ? "" : ` · ${result.remainingDays} 天`}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ambient-shadow mb-8 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">等待审计结果</h3>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="ambient-shadow overflow-hidden rounded-3xl border border-surface-container/10 bg-surface-container-lowest">
            <div className="flex flex-col gap-4 border-b border-surface-container-high p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">最近扫描</h3>
              </div>
              {isDebugMode ? (
                <div className="inline-flex rounded-2xl border border-surface-container bg-surface-container-low p-1">
                  {[DEFAULT_SCAN_WINDOW_DAYS, DEBUG_SCAN_WINDOW_DAYS].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setScanWindowDays(days)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                        scanWindowDays === days ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {getScanWindowLabel(days)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {scanHistoryQuery.isLoading ? (
              <div className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-on-surface-variant">
                <LoaderCircle size={18} className="animate-spin" />
                正在加载扫码记录...
              </div>
            ) : scanHistoryQuery.error ? (
              <div className="px-6 py-12 text-center text-sm text-red-600">
                扫码记录加载失败：{formatErrorMessage(scanHistoryQuery.error, QR_SCAN_ERROR_MESSAGE_OPTIONS)}
              </div>
            ) : recentScans.length > 0 ? (
              <div className="px-6 py-6">
                <QrScanHistoryCards scans={pagedRecentScans} />
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} className="mt-6" />
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-on-surface-variant">暂无扫描记录。</div>
            )}
          </section>
        </div>
      </div>
  );
};

const QrScanHistoryCards: React.FC<{ scans: QrScanAuditItemDto[] }> = ({ scans }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    {scans.map((scan) => {
      const statusMeta = getQrScanStatusMeta(scan.status);
      return (
        <article
          key={scan.auditId}
          className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5 transition-colors hover:bg-surface-container-low/30"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">扫描时间</div>
              <div className="mt-1 text-sm font-semibold text-on-surface">{formatDateTime(scan.scannedAt)}</div>
            </div>
            <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-bold", statusMeta.badgeClassName)}>
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">批次</div>
              <div className="mt-1 text-sm font-semibold text-on-surface">{scan.batchCode ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">扫码用户</div>
              <div className="mt-1 text-sm text-on-surface-variant">{scan.scannerUser ?? "-"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">审计 ID</div>
              <div className="mt-1 break-all font-mono text-xs text-on-surface-variant">{scan.auditId}</div>
            </div>
          </div>
        </article>
      );
    })}
  </div>
);
