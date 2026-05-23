import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ClipboardPaste, Keyboard, LoaderCircle, QrCode, RotateCcw, ScanLine } from "lucide-react";
import { ApiClientError, createQrScan, type QrScanResultDto, type QrScanSource } from "../../api";
import { cn } from "../../lib/utils";
import { createClientScanId, getQrScanStatusMeta } from "../../lib/qrScan";
import { getErrorDebugDetail, OperationFeedbackToast, type OperationFeedbackState } from "../common/OperationFeedbackToast";
import { OperationAlert } from "../common/OperationAlert";

interface RecentScanEntry extends QrScanResultDto {
  scannedAt: string;
  source: QrScanSource;
}

const MAX_RECENT_SCANS = 8;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    switch (error.message) {
      case "validation_error":
        return "二维码提交参数不符合后端校验规则。";
      case "invalid_response":
        return "后端返回格式不符合约定。";
      default:
        return `请求失败：${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "扫码审计提交失败，请稍后重试。";
}

const QrScanResultPanel: React.FC<{ result: QrScanResultDto }> = ({ result }) => {
  const statusMeta = getQrScanStatusMeta(result.status);

  return (
    <OperationAlert
      type={statusMeta.alertType}
      title={statusMeta.label}
      description={result.message}
      showIcon
      className="ambient-shadow"
    />
  );
};

export const QrScanPage: React.FC = () => {
  const [qrInput, setQrInput] = useState("");
  const [source, setSource] = useState<QrScanSource>("handheld");
  const [deviceId, setDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QrScanResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanEntry[]>([]);
  const [feedback, setFeedback] = useState<OperationFeedbackState | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

    const scannedAt = new Date().toISOString();
    setSubmitting(true);
    setError(null);

    try {
      const scanResult = await createQrScan({
        qr,
        source,
        deviceId: deviceId.trim() || null,
        clientScanId: createClientScanId(),
        scannedAt,
      });
      setResult(scanResult);
      setRecentScans((currentScans) => [
        { ...scanResult, scannedAt, source },
        ...currentScans.slice(0, MAX_RECENT_SCANS - 1),
      ]);
      setFeedback({
        type: scanResult.status === "invalid" || scanResult.status === "revoked" || scanResult.status === "not_found" ? "warning" : "success",
        title: "扫码审计已提交",
        description: scanResult.message,
      });
      setFeedbackOpen(true);
      setQrInput("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setFeedback({
        type: "error",
        title: "扫码审计失败",
        description: getErrorMessage(requestError),
        debugDetail: getErrorDebugDetail(requestError),
      });
      setFeedbackOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, [deviceId, qrInput, source]);

  return (
    <>
      <OperationFeedbackToast open={feedbackOpen} feedback={feedback} onClose={() => setFeedbackOpen(false)} />
      <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">扫码审计</h2>
          <p className="mt-1 text-on-surface-variant">二维码效期状态由后端审计接口返回。</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
          <ScanLine size={16} />
          接口来源：`/api/qr-scans`
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <section className="ambient-shadow rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <QrCode size={22} />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">审计提交</h3>
                <p className="mt-1 text-sm text-on-surface-variant">提交后清空输入并记录最近结果。</p>
              </div>
            </div>

            <label className="space-y-2">
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

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">来源</span>
                <select
                  value={source}
                  onChange={(event) => setSource(event.target.value as QrScanSource)}
                  disabled={submitting}
                  className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="handheld">外接扫码枪</option>
                  <option value="web_camera">网页输入</option>
                  <option value="mobile_camera">移动端相机</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">设备 ID</span>
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  disabled={submitting}
                  className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="可选"
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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

        <section className="space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={result.auditId}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <QrScanResultPanel result={result} />
                <div className="ambient-shadow rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6">
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
                        {result.expireDate ?? "-"}
                        {result.remainingDays === null ? "" : ` · ${result.remainingDays} 天`}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ambient-shadow rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">等待审计结果</h3>
                <p className="mt-2 text-sm text-on-surface-variant">提交二维码后，这里显示后端返回的批次效期状态。</p>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="ambient-shadow overflow-hidden rounded-3xl border border-surface-container/10 bg-surface-container-lowest">
            <div className="border-b border-surface-container-high p-6">
              <h3 className="font-headline text-xl font-bold text-on-surface">最近扫描</h3>
              <p className="mt-1 text-sm text-on-surface-variant">仅展示后端审计结果，不展示二维码 token。</p>
            </div>
            {recentScans.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">时间</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">批次</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">状态</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">审计 ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {recentScans.map((scan) => {
                      const statusMeta = getQrScanStatusMeta(scan.status);
                      return (
                        <tr key={scan.auditId} className="transition-colors hover:bg-surface-container-low/30">
                          <td className="px-6 py-5 text-sm text-on-surface-variant">{formatDateTime(scan.scannedAt)}</td>
                          <td className="px-6 py-5 text-sm font-semibold text-on-surface">{scan.batchCode ?? "-"}</td>
                          <td className="px-6 py-5">
                            <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-bold", statusMeta.badgeClassName)}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-6 py-5 font-mono text-xs text-on-surface-variant">{scan.auditId}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-on-surface-variant">暂无扫描记录。</div>
            )}
          </section>
        </section>
      </div>
      </div>
    </>
  );
};
