import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { History, LoaderCircle, MapPin, Package, RotateCcw, Search, TriangleAlert, X } from "lucide-react";
import {
  ApiClientError,
  createBatchOperation,
  formatErrorMessage,
  listBatchOperations,
  listBatches,
  listProducts,
  parseQuantity,
  queryKeys,
  revertBatchOperation,
  type ApiListData,
  type BatchDto,
  type BatchOperationDto,
} from "../../api";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useNotification } from "../../providers/NotificationProvider";
import type { Product } from "./ProductManagement.types";

const FETCH_PAGE_SIZE = 100;

export interface LossFormState {
  quantity: string;
  remarks: string;
}

interface LossHistoryEntry {
  operation: BatchOperationDto;
  batch: BatchDto;
  product: Product;
  canRevert: boolean;
}

export interface ProductLossCardData {
  product: Product;
  batches: BatchDto[];
  totalQuantity: number;
  reportableBatchCount: number;
}

type LossHistoryWindowDays = 7 | 30;

interface RevertFormState {
  remarks: string;
}

export const DEFAULT_LOSS_FORM: LossFormState = {
  quantity: "",
  remarks: "",
};

const DEFAULT_REVERT_FORM: RevertFormState = {
  remarks: "",
};

const DEFAULT_HISTORY_WINDOW_DAYS: LossHistoryWindowDays = 7;
const DEBUG_HISTORY_WINDOW_DAYS: LossHistoryWindowDays = 30;

interface LossFilters {
  query: string;
  category: string;
}

async function loadAllPages<TItem, TParams extends { page?: number; size?: number }>(
  loader: (params: TParams) => Promise<ApiListData<TItem>>,
  params: Omit<TParams, "page"> & { size?: number } = {} as Omit<TParams, "page"> & { size?: number },
) {
  const size = params.size ?? FETCH_PAGE_SIZE;
  const firstPage = await loader({ ...params, page: 1, size } as TParams);
  const total = firstPage.pagination?.total ?? firstPage.items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));

  if (totalPages === 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      loader({ ...params, page: index + 2, size } as TParams).then((response) => response.items),
    ),
  );

  return [firstPage.items, ...remainingPages].flat();
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatQuantity(value: string | number) {
  const numericValue = typeof value === "number" ? value : parseQuantity(value);
  return numericValue.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function normalizeText(value: string | null) {
  return value?.trim() || "-";
}

function getHistoryWindowCutoff(days: LossHistoryWindowDays) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (days === DEBUG_HISTORY_WINDOW_DAYS) {
    cutoff.setMonth(cutoff.getMonth() - 1);
    return cutoff.getTime();
  }

  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff.getTime();
}

function getHistoryWindowLabel(days: LossHistoryWindowDays) {
  return days === DEBUG_HISTORY_WINDOW_DAYS ? "最近 1 个月" : "最近 7 天";
}

function sortOperationsByCreatedAtDesc(items: BatchOperationDto[]) {
  return [...items].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

async function loadLossOperationsWithinWindow(batchId: number, cutoffMs: number) {
  const items: BatchOperationDto[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await listBatchOperations(batchId, {
      operation_type: "loss",
      page,
      size: FETCH_PAGE_SIZE,
    });
    const pageItems = sortOperationsByCreatedAtDesc(response.items);
    totalPages = Math.max(1, Math.ceil((response.pagination?.total ?? response.items.length) / FETCH_PAGE_SIZE));

    items.push(...pageItems.filter((operation) => new Date(operation.created_at).getTime() >= cutoffMs));

    if (pageItems.length === 0) {
      break;
    }

    // Stop once the current page has already crossed the active history window.
    const oldestItemTime = new Date(pageItems[pageItems.length - 1].created_at).getTime();
    if (oldestItemTime < cutoffMs) {
      break;
    }

    page += 1;
  }

  return items;
}

const LOSS_REPORT_ERROR_MESSAGE_OPTIONS = {
  apiClientMessages: {
    validation_error: "请求参数不符合后端校验规则。",
    conflict: "操作失败，当前批次数据可能已被其他人更新，或该记录已不允许再次撤销。",
    not_found: "目标批次不存在。",
  },
};

function getErrorDebugDetail(error: unknown) {
  if (error instanceof ApiClientError) {
    return `ApiClientError: status=${error.status}, code=${error.code ?? "null"}, message=${error.message}`;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return JSON.stringify(error);
}

export function LossReportModal({
  open,
  card,
  selectedBatchId,
  form,
  submitting,
  error,
  onClose,
  onSelectBatch,
  onChange,
  onSubmit,
}: {
  open: boolean;
  card: ProductLossCardData | null;
  selectedBatchId: number | null;
  form: LossFormState;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSelectBatch: (batchId: number) => void;
  onChange: (field: keyof LossFormState, value: string) => void;
  onSubmit: () => void;
}) {
  const selectedBatch = card?.batches.find((batch) => batch.id === selectedBatchId) ?? null;

  return (
    <AnimatePresence>
      {open && card ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-[3px]"
            onClick={submitting ? undefined : onClose}
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
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">发起报损</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    当前货物：{card.product.product_name}。报损会直接写入 Django `batch operations` 接口。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid flex-1 gap-8 overflow-y-auto px-8 py-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-surface-container/70 bg-surface-container-low p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-headline text-xl font-bold text-on-surface">{card.product.product_name}</div>
                        <div className="mt-1 text-sm text-on-surface-variant">条码：{card.product.barcode || "-"}</div>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">当前库存</div>
                        <div className="mt-1 font-headline text-lg font-bold text-on-surface">{formatQuantity(card.totalQuantity)}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">厂商</div>
                        <div className="mt-2 text-sm font-semibold text-on-surface">{card.product.manufacturer}</div>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">库位 / 单位</div>
                        <div className="mt-2 text-sm font-semibold text-on-surface">
                          {normalizeText(card.product.location)} / {normalizeText(card.product.unit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-headline text-lg font-bold text-on-surface">选择批次</h4>
                        <p className="mt-1 text-sm text-on-surface-variant">只能对当前货物下仍有库存的批次执行报损。</p>
                      </div>
                      <div className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                        {card.reportableBatchCount} 个可报损批次
                      </div>
                    </div>
                    <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                      {card.batches.length > 0 ? (
                        card.batches.map((batch) => {
                          const isSelected = batch.id === selectedBatchId;
                          const quantity = parseQuantity(batch.quantity);
                          return (
                            <button
                              key={batch.id}
                              type="button"
                              onClick={() => onSelectBatch(batch.id)}
                              className={cn(
                                "rounded-3xl border p-5 text-left transition-all",
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-surface-container bg-surface-container-lowest hover:border-primary/25 hover:bg-surface-container-low",
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="font-headline text-lg font-bold text-on-surface">
                                    批次 {batch.batch_code}
                                  </div>
                                  <div className="mt-1 text-sm text-on-surface-variant">
                                    生产日期 {formatDate(batch.manufacture_date)} · 到期日期 {formatDate(batch.expire_date)}
                                  </div>
                                </div>
                                <div className="rounded-2xl bg-surface-container-low px-3 py-2 text-right">
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">可用数量</div>
                                  <div className="mt-1 font-headline text-base font-bold text-on-surface">{formatQuantity(quantity)}</div>
                                </div>
                              </div>
                              <div className="mt-3 text-sm text-on-surface-variant">
                                收货日期 {formatDate(batch.received_at)} {batch.remarks ? `· ${batch.remarks}` : ""}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-3xl border border-dashed border-surface-container bg-surface-container-low px-5 py-10 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-on-surface-variant shadow-sm">
                            <Package size={24} />
                          </div>
                          <h4 className="mt-4 text-lg font-bold text-on-surface">暂无可报损批次</h4>
                          <p className="mt-2 text-sm text-on-surface-variant">当前货物还没有库存批次，无法直接发起报损。</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-surface-container/70 bg-surface-container-low p-6">
                    <div className="font-headline text-lg font-bold text-on-surface">报损信息</div>
                    <div className="mt-1 text-sm text-on-surface-variant">先选批次，再填写本次报损数量和备注。</div>

                    <div className="mt-5 space-y-4">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-on-surface">报损数量 *</span>
                        <input
                          value={form.quantity}
                          onChange={(event) => onChange("quantity", event.target.value)}
                          placeholder="例如 2 或 2.5"
                          className="w-full rounded-2xl border border-surface-container bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-on-surface">备注</span>
                        <textarea
                          value={form.remarks}
                          onChange={(event) => onChange("remarks", event.target.value)}
                          rows={5}
                          placeholder="可选，例如包装破损、运输挤压、冷链异常"
                          className="w-full rounded-2xl border border-surface-container bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                    </div>
                  </div>

                  {selectedBatch ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                      当前选中批次 <span className="font-bold">{selectedBatch.batch_code}</span>，可用数量{" "}
                      <span className="font-bold">{formatQuantity(selectedBatch.quantity)}</span>。
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
                  ) : null}

                </div>
              </div>

              <div className="flex flex-col items-stretch justify-end gap-3 border-t border-surface-container-high bg-white/80 p-6 backdrop-blur-sm sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting || !selectedBatch}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <TriangleAlert size={16} />}
                  确认报损
                </button>
              </div>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function LossHistoryModal({
  open,
  windowDays,
  showExtendedWindowToggle,
  entries,
  loading,
  error,
  revertingEntry,
  revertForm,
  revertError,
  reverting,
  onChangeRevertForm,
  onChangeWindow,
  onOpenRevert,
  onCloseRevert,
  onConfirmRevert,
  onClose,
}: {
  open: boolean;
  windowDays: LossHistoryWindowDays;
  showExtendedWindowToggle: boolean;
  entries: LossHistoryEntry[];
  loading: boolean;
  error: string | null;
  revertingEntry: LossHistoryEntry | null;
  revertForm: RevertFormState;
  revertError: string | null;
  reverting: boolean;
  onChangeRevertForm: (value: string) => void;
  onChangeWindow: (days: LossHistoryWindowDays) => void;
  onOpenRevert: (entry: LossHistoryEntry) => void;
  onCloseRevert: () => void;
  onConfirmRevert: () => void;
  onClose: () => void;
}) {
  const activeWindowLabel = getHistoryWindowLabel(windowDays);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.section
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="ambient-shadow pointer-events-auto relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between border-b border-surface-container-high px-8 py-6">
                <div>
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">报损记录</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    生产模式默认展示最近 7 天报损记录，开发模式可扩展查看最近 1 个月。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-surface-container bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-8 py-8">
                <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-surface-container/70 bg-surface-container-low p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-on-surface">当前范围</div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      {showExtendedWindowToggle ? "默认展示最近 7 天，可切换查看最近 1 个月。" : "当前默认展示最近 7 天报损记录。"}
                    </div>
                  </div>

                  {showExtendedWindowToggle ? (
                    <div className="inline-flex rounded-2xl bg-surface-container p-1">
                      {[DEFAULT_HISTORY_WINDOW_DAYS, DEBUG_HISTORY_WINDOW_DAYS].map((days) => {
                        const isActive = windowDays === days;
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => onChangeWindow(days)}
                            className={cn(
                              "rounded-2xl px-4 py-2 text-sm font-semibold transition-all",
                              isActive ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-primary",
                            )}
                          >
                            {getHistoryWindowLabel(days)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                      {activeWindowLabel}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <LoaderCircle size={28} className="animate-spin text-on-surface-variant" />
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">正在汇总报损记录</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">正在加载 {activeWindowLabel} 内的报损记录。</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
                ) : entries.length > 0 ? (
                  <div className="space-y-4">
                    {entries.map((entry) => {
                      const { operation, batch, product, canRevert } = entry;

                      return (
                      <div
                        key={operation.id}
                        className="rounded-3xl border border-surface-container bg-surface-container-lowest p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="font-headline text-xl font-bold text-on-surface">{product.product_name}</div>
                            <div className="mt-1 text-sm text-on-surface-variant">
                              批次 {batch.batch_code} · 条码 {product.barcode || "-"} · {product.manufacturer}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-red-50 px-4 py-3 text-right text-red-600">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em]">报损数量</div>
                            <div className="mt-1 font-headline text-lg font-bold">{formatQuantity(operation.quantity)}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">报损后余量</div>
                            <div className="mt-2 text-sm font-semibold text-on-surface">{formatQuantity(operation.quantity_after)}</div>
                          </div>
                          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">记录时间</div>
                            <div className="mt-2 text-sm font-semibold text-on-surface">{formatDateTime(operation.created_at)}</div>
                          </div>
                          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">批次到期日期</div>
                            <div className="mt-2 text-sm font-semibold text-on-surface">{formatDate(batch.expire_date)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                          <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5">
                            <MapPin size={14} />
                            {normalizeText(product.location)}
                          </span>
                          {operation.is_reverted ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
                              已冲销
                            </span>
                          ) : null}
                          {operation.remarks ? <span>备注：{operation.remarks}</span> : <span>备注：无</span>}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onOpenRevert(entry)}
                            disabled={!canRevert}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all",
                              canRevert
                                ? "border border-surface-container bg-surface-container-low text-on-surface hover:border-primary/20 hover:text-primary"
                                : "cursor-not-allowed border border-surface-container bg-surface-container-low text-on-surface-variant opacity-60",
                            )}
                          >
                            <RotateCcw size={16} />
                            {operation.is_reverted ? "该记录已撤销" : "撤销报损"}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                      <History size={28} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">暂无报损记录</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">{activeWindowLabel}内还没有任何批次执行过 `loss` 操作。</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          </div>

          <AnimatePresence>
            {revertingEntry ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-[2px]"
                  onClick={reverting ? undefined : onCloseRevert}
                />
                <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4">
                  <motion.section
                    initial={{ opacity: 0, scale: 0.96, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 24 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    className="ambient-shadow pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
                  >
                    <div className="border-b border-surface-container-high px-8 py-6">
                      <h4 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">撤销报损</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        将为批次 {revertingEntry.batch.batch_code} 创建一条反向 `add` 操作。本批次只允许撤销一次。
                      </p>
                    </div>

                    <div className="space-y-5 px-8 py-8">
                      <div className="rounded-3xl border border-surface-container/70 bg-surface-container-low p-5">
                        <div className="font-headline text-lg font-bold text-on-surface">{revertingEntry.product.product_name}</div>
                        <div className="mt-2 text-sm text-on-surface-variant">
                          原报损数量 {formatQuantity(revertingEntry.operation.quantity)} · 报损时间 {formatDateTime(revertingEntry.operation.created_at)}
                        </div>
                      </div>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-on-surface">撤销备注</span>
                        <textarea
                          value={revertForm.remarks}
                          onChange={(event) => onChangeRevertForm(event.target.value)}
                          rows={4}
                          placeholder="可选，例如误操作、盘点修正"
                          className="w-full rounded-2xl border border-surface-container bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>

                      {revertError ? (
                        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{revertError}</div>
                      ) : null}

                      <div className="flex items-center justify-end gap-3 border-t border-surface-container-high pt-5">
                        <button
                          type="button"
                          onClick={onCloseRevert}
                          disabled={reverting}
                          className="rounded-2xl border border-surface-container px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={onConfirmRevert}
                          disabled={reverting}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reverting ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                          确认撤销
                        </button>
                      </div>
                    </div>
                  </motion.section>
                </div>
              </>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export const LossReportPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canSubmitLoss = hasPermission("batch_operations_loss");
  const canReadOperations = hasPermission("batch_operations_read");
  const canRevertOperations = hasPermission("batch_operations_revert");
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyWindowDays, setHistoryWindowDays] = useState<LossHistoryWindowDays>(DEFAULT_HISTORY_WINDOW_DAYS);
  const [selectedCard, setSelectedCard] = useState<ProductLossCardData | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [form, setForm] = useState<LossFormState>(DEFAULT_LOSS_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revertingEntry, setRevertingEntry] = useState<LossHistoryEntry | null>(null);
  const [revertForm, setRevertForm] = useState<RevertFormState>(DEFAULT_REVERT_FORM);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [filters, setFilters] = useState<LossFilters>({
    query: "",
    category: "",
  });
  const isDebugMode = import.meta.env.DEV;
  const notify = useNotification();

  const productsQuery = useQuery({
    queryKey: [...queryKeys.products.lists(), "all-pages"],
    queryFn: () => loadAllPages(listProducts),
  });

  const batchesQuery = useQuery({
    queryKey: [...queryKeys.batches.lists(), "all-pages"],
    queryFn: () => loadAllPages(listBatches),
  });

  const historyQuery = useQuery({
    queryKey: [...queryKeys.operations.all, "loss-history", historyWindowDays],
    enabled: canReadOperations && isHistoryOpen && batchesQuery.status === "success" && productsQuery.status === "success",
    queryFn: async () => {
      const products = productsQuery.data ?? [];
      const batches = batchesQuery.data ?? [];
      const productMap = new Map(products.map((product) => [product.id, product]));
      const cutoffMs = getHistoryWindowCutoff(historyWindowDays);

      const operationGroups = await Promise.all(
        batches.map(async (batch) => {
          const product = productMap.get(batch.product_id);
          if (!product) {
            return [];
          }

          const items = await loadLossOperationsWithinWindow(batch.id, cutoffMs);
          if (items.length === 0) {
            return [];
          }

          return items.map((operation) => ({
            operation,
            batch,
            product,
            canRevert: canRevertOperations && !operation.is_reverted && operation.reversed_operation_id === null,
          }));
        }),
      );

      return operationGroups
        .flat()
        .sort((left, right) => new Date(right.operation.created_at).getTime() - new Date(left.operation.created_at).getTime());
    },
  });

  const openHistoryModal = () => {
    if (!canReadOperations) {
      return;
    }
    setHistoryWindowDays(DEFAULT_HISTORY_WINDOW_DAYS);
    setIsHistoryOpen(true);
  };

  const isLoading = productsQuery.isLoading || batchesQuery.isLoading;
  const pageError = productsQuery.error
    ? formatErrorMessage(productsQuery.error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS)
    : batchesQuery.error
      ? formatErrorMessage(batchesQuery.error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS)
      : null;

  const productCards = useMemo(() => {
    const products = productsQuery.data ?? [];
    const batches = batchesQuery.data ?? [];
    const batchMap = new Map<number, BatchDto[]>();

    batches.forEach((batch) => {
      const quantity = parseQuantity(batch.quantity);
      if (quantity <= 0) {
        return;
      }

      const currentBatches = batchMap.get(batch.product_id) ?? [];
      currentBatches.push(batch);
      batchMap.set(batch.product_id, currentBatches);
    });

    return [...products]
      .sort((left, right) => left.product_name.localeCompare(right.product_name, "zh-CN"))
      .map((product) => {
        const reportableBatches = (batchMap.get(product.id) ?? []).sort(
          (left, right) => new Date(left.received_at).getTime() - new Date(right.received_at).getTime(),
        );

        return {
          product,
          batches: reportableBatches,
          totalQuantity: reportableBatches.reduce((sum, batch) => sum + parseQuantity(batch.quantity), 0),
          reportableBatchCount: reportableBatches.length,
        };
      });
  }, [batchesQuery.data, productsQuery.data]);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          productCards
            .map((card) => card.product.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [productCards],
  );

  const filteredProductCards = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return productCards.filter((card) => {
      const matchesCategory = !filters.category || card.product.category === filters.category;
      const matchesQuery =
        !query ||
        card.product.product_name.toLowerCase().includes(query) ||
        card.product.barcode.toLowerCase().includes(query) ||
        card.product.manufacturer.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [filters.category, filters.query, productCards]);

  useEffect(() => {
    if (!isDebugMode && historyWindowDays !== DEFAULT_HISTORY_WINDOW_DAYS) {
      setHistoryWindowDays(DEFAULT_HISTORY_WINDOW_DAYS);
    }
  }, [historyWindowDays, isDebugMode]);

  const isHistoryLoading = productsQuery.isLoading || batchesQuery.isLoading || historyQuery.isLoading;

  const openLossModal = (card: ProductLossCardData) => {
    if (!canSubmitLoss) {
      return;
    }
    setSelectedCard(card);
    setSelectedBatchId(card.batches[0]?.id ?? null);
    setForm(DEFAULT_LOSS_FORM);
    setSubmitError(null);
    setIsLossModalOpen(true);
  };

  const closeLossModal = () => {
    if (isSubmitting) {
      return;
    }
    setIsLossModalOpen(false);
    setSelectedCard(null);
    setSelectedBatchId(null);
    setForm(DEFAULT_LOSS_FORM);
    setSubmitError(null);
  };

  const handleFormChange = (field: keyof LossFormState, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setSubmitError(null);
  };

  const handleSubmitLoss = async () => {
    if (!canSubmitLoss) {
      setSubmitError("当前账号没有提交报损的权限。");
      return;
    }
    if (!selectedCard || !selectedBatchId) {
      setSubmitError("请先选择一个可报损批次。");
      return;
    }

    const selectedBatch = selectedCard.batches.find((batch) => batch.id === selectedBatchId);
    if (!selectedBatch) {
      setSubmitError("目标批次不存在，请重新选择。");
      return;
    }

    const quantityValue = Number.parseFloat(form.quantity);
    const availableQuantity = parseQuantity(selectedBatch.quantity);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setSubmitError("请输入有效的报损数量。");
      return;
    }

    if (quantityValue > availableQuantity) {
      setSubmitError(`报损数量不能超过当前批次的可用数量 ${formatQuantity(availableQuantity)}。`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createBatchOperation(selectedBatchId, {
        operation_type: "loss",
        quantity: form.quantity.trim(),
        remarks: form.remarks,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.operations.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      ]);
      notify.success({
        title: "报损提交成功",
        description: `已为批次 ${selectedBatch.batch_code} 记录报损，货物库存会同步刷新。`,
      });
      closeLossModal();
    } catch (error) {
      setSubmitError(formatErrorMessage(error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS));
      notify.error({
        title: "报损提交失败",
        description: formatErrorMessage(error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRevertModal = (entry: LossHistoryEntry) => {
    if (!canRevertOperations || !entry.canRevert) {
      return;
    }
    setRevertingEntry(entry);
    setRevertForm(DEFAULT_REVERT_FORM);
    setRevertError(null);
  };

  const closeRevertModal = () => {
    if (isReverting) {
      return;
    }
    setRevertingEntry(null);
    setRevertForm(DEFAULT_REVERT_FORM);
    setRevertError(null);
  };

  const handleConfirmRevert = async () => {
    if (!revertingEntry || !revertingEntry.canRevert) {
      setRevertError("当前记录不允许撤销。");
      return;
    }

    setIsReverting(true);
    setRevertError(null);

    try {
      await revertBatchOperation(revertingEntry.batch.id, revertingEntry.operation.id, {
        remarks: revertForm.remarks,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.operations.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      ]);
      notify.success({
        title: "撤销报损成功",
        description: `批次 ${revertingEntry.batch.batch_code} 已创建反向操作，库存数量已回滚。`,
      });
      closeRevertModal();
    } catch (error) {
      setRevertError(formatErrorMessage(error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS));
      notify.error({
        title: "撤销报损失败",
        description: formatErrorMessage(error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsReverting(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      query: "",
      category: "",
    });
  };

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">报损管理</h2>
        </div>
        {canReadOperations ? (
          <button
            type="button"
            onClick={openHistoryModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
          >
            <History size={18} />
            报损记录
          </button>
        ) : null}
      </div>

      {pageError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
          {pageError}
        </div>
      ) : null}

      <section className="mb-8 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="搜索货物名称、条码或厂商"
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <div className="flex flex-col gap-4 md:flex-row">
            <select
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className="min-w-[200px] rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">全部分类</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-container px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <RotateCcw size={16} />
              重置筛选
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
        <div className="mb-6 flex flex-col gap-3 border-b border-surface-container-high pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">货物卡片</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {isLoading
                ? "正在同步货物与批次数据..."
                : `当前共 ${filteredProductCards.length} 个货物，其中 ${filteredProductCards.filter((card) => card.reportableBatchCount > 0).length} 个货物可直接发起报损。`}
            </p>
          </div>
          {isDebugMode ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-surface-container bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant">
              数据来源：`/api/products` + `/api/batches`
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <LoaderCircle size={30} className="animate-spin text-on-surface-variant" />
            <div>
              <h4 className="text-lg font-bold text-on-surface">正在加载报损页数据</h4>
              <p className="mt-1 text-sm text-on-surface-variant">请确认 Django 服务已启动，且产品与批次接口可正常访问。</p>
            </div>
          </div>
        ) : filteredProductCards.length > 0 ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] 2xl:[grid-template-columns:repeat(4,minmax(0,1fr))]">
            {filteredProductCards.map((card) => (
              <article
                key={card.product.id}
                className="flex h-full flex-col rounded-[2rem] border border-surface-container/70 bg-surface-container-lowest p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-headline text-lg font-bold text-on-surface">{card.product.product_name}</h4>
                    <p className="mt-1 text-sm text-on-surface-variant">条码：{card.product.barcode || "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low px-3 py-2 text-right">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">可报损批次</div>
                    <div className="mt-1 font-headline text-lg font-bold text-on-surface">{card.reportableBatchCount}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">当前库存</div>
                    <div className="mt-2 font-headline text-xl font-bold text-on-surface">{formatQuantity(card.totalQuantity)}</div>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">保质期</div>
                    <div className="mt-2 text-base font-bold text-on-surface">{card.product.shelf_life_days} 天</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-on-surface-variant">
                  <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                    <span>厂商</span>
                    <span className="font-semibold text-on-surface">{card.product.manufacturer}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                    <span>分类</span>
                    <span className="font-semibold text-on-surface">{normalizeText(card.product.category)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                    <span>库位</span>
                    <span className="font-semibold text-on-surface">{normalizeText(card.product.location)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                    <span>单位</span>
                    <span className="font-semibold text-on-surface">{normalizeText(card.product.unit)}</span>
                  </div>
                </div>

                <div className="mt-6 flex-1" />

                <button
                  type="button"
                  onClick={() => openLossModal(card)}
                  disabled={card.reportableBatchCount === 0 || !canSubmitLoss}
                  className={cn(
                    "mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition-all",
                    card.reportableBatchCount > 0 && canSubmitLoss
                      ? "bg-gradient-to-r from-primary to-primary-container text-white hover:shadow-lg"
                      : "cursor-not-allowed bg-surface-container-high text-on-surface-variant",
                  )}
                >
                  <TriangleAlert size={16} />
                  {!canSubmitLoss ? "无报损权限" : card.reportableBatchCount > 0 ? "报损" : "暂无可报损批次"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
              <Package size={28} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-on-surface">未找到匹配货物</h4>
              <p className="mt-1 text-sm text-on-surface-variant">可以尝试调整搜索关键词或重置筛选条件。</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl border border-surface-container px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            >
              重置筛选
            </button>
          </div>
        )}
      </section>

      <LossReportModal
        open={isLossModalOpen}
        card={selectedCard}
        selectedBatchId={selectedBatchId}
        form={form}
        submitting={isSubmitting}
        error={submitError}
        onClose={closeLossModal}
        onSelectBatch={(batchId) => {
          setSelectedBatchId(batchId);
          setSubmitError(null);
        }}
        onChange={handleFormChange}
        onSubmit={handleSubmitLoss}
      />

      <LossHistoryModal
        open={isHistoryOpen}
        windowDays={historyWindowDays}
        showExtendedWindowToggle={isDebugMode}
        entries={historyQuery.data ?? []}
        loading={isHistoryLoading}
        error={historyQuery.error ? formatErrorMessage(historyQuery.error, LOSS_REPORT_ERROR_MESSAGE_OPTIONS) : null}
        revertingEntry={revertingEntry}
        revertForm={revertForm}
        revertError={revertError}
        reverting={isReverting}
        onChangeRevertForm={(value) => {
          setRevertForm({ remarks: value });
          setRevertError(null);
        }}
        onChangeWindow={setHistoryWindowDays}
        onOpenRevert={openRevertModal}
        onCloseRevert={closeRevertModal}
        onConfirmRevert={handleConfirmRevert}
        onClose={() => setIsHistoryOpen(false)}
      />
    </>
  );
};
