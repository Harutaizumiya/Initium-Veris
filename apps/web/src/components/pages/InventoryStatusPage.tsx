import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheckBig, Clock3, LayoutDashboard, LayoutGrid, List, LoaderCircle, Package, Plus, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import {
  ApiClientError,
  buildInventoryDetail,
  createBatch,
  createBatchOperation,
  getBatchLabelPayload,
  getShelfLifeMetricsFromDates,
  listBatches,
  listProductBatches,
  listProducts,
  mergeInventoryRecord,
  parseQuantity,
  queryKeys,
  toInventoryRecord,
  type BatchDto,
} from "../../api";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useNotification } from "../../providers/NotificationProvider";
import { FloatingActionButtons } from "../actions/FloatingActionButtons";
import { Pagination } from "../common/Pagination";
import { StatCard } from "../dashboard/StatCard";
import { InventoryBatchDetailModal } from "./InventoryBatchDetailModal";
import { InventoryStatusCard } from "./InventoryStatusCard";
import { LabelPrintModal } from "./LabelPrintModal";
import {
  DEFAULT_LOSS_FORM,
  LossReportModal,
  type LossFormState,
  type ProductLossCardData,
} from "./LossReportPage";
import type { LabelPrintPayload } from "../../lib/labelPrinter";
import type { Product } from "./ProductManagement.types";
import type { InventoryBatchDetail, InventoryHealth, InventoryHealthMeta, InventoryRecord, ShelfLifeMetrics } from "./InventoryStatus.types";

type InventoryView = "card" | "list";

interface NewBatchFormState {
  query: string;
  quantity: string;
  manufactureDate: string;
  remarks: string;
}

interface InventoryViewModel {
  item: InventoryRecord;
  metrics: ShelfLifeMetrics;
  meta: InventoryHealthMeta;
  quantityValue: number;
  formattedQuantity: string;
  formattedManufactureDate: string;
  formattedExpireDate: string;
  formattedReceivedDate: string;
}

const LIST_PAGE_SIZE = 6;
const CARD_MIN_WIDTH = 280;
const CARD_GRID_GAP = 16;
const CARD_ROWS_PER_PAGE = 2;
const BATCH_LIST_FETCH_SIZE = 100;
const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
const QUERY_GC_TIME_MS = 30 * 60 * 1000;
const PRODUCT_OPTION_LIST_HEIGHT = 180;
const DEFAULT_NEW_BATCH_FORM: NewBatchFormState = {
  query: "",
  quantity: "",
  manufactureDate: new Date().toISOString().slice(0, 10),
  remarks: "",
};
function formatQuantity(quantity: string) {
  const numericValue = parseQuantity(quantity);
  return numericValue.toLocaleString("zh-CN", {
    minimumFractionDigits: quantity.includes(".") ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function getShelfLifeMetrics(item: InventoryRecord): ShelfLifeMetrics {
  return getShelfLifeMetricsFromDates(item.expireDate, item.manufactureDate);
}

function getHealthMeta(health: InventoryHealth, expiryStatus?: string | null): InventoryHealthMeta {
  const isExpired = expiryStatus === "expired";

  if (health === "critical" && isExpired) {
    return {
      label: "已过期",
      hint: "该批次已超过保质期，请立即处置",
      tagClassName: "bg-red-50 text-red-500 border-red-200",
      lineClassName: "bg-red-500",
      icon: <CircleAlert size={14} className="text-red-500" />,
      progress: "bg-red-500",
    };
  }

  if (health === "critical") {
    return {
      label: "临期",
      hint: "该批次临近保质期，请优先处理",
      tagClassName: "bg-amber-50 text-amber-700 border-amber-200",
      lineClassName: "bg-amber-500",
      icon: <CircleAlert size={14} className="text-amber-600" />,
      progress: "bg-amber-500",
    };
  }

  if (health === "warning") {
    return {
      label: "临期",
      hint: "请关注剩余效期",
      tagClassName: "bg-amber-50 text-amber-700 border-amber-200",
      lineClassName: "bg-amber-400",
      icon: <Clock3 size={14} className="text-amber-600" />,
      progress: "bg-amber-400",
    };
  }

  return {
    label: "效期健康",
    hint: "批次效期处于安全区间",
    tagClassName: "bg-blue-50 text-blue-500 border-blue-200",
    lineClassName: "bg-sky-500",
    icon: <CircleCheckBig size={14} className="text-sky-500" />,
    progress: "bg-sky-500",
  };
}

function toInventoryViewModel(item: InventoryRecord): InventoryViewModel {
  const metrics = getShelfLifeMetrics(item);

  return {
    item,
    metrics,
    meta: getHealthMeta(metrics.health, item.expiryStatus),
    quantityValue: parseQuantity(item.quantity),
    formattedQuantity: formatQuantity(item.quantity),
    formattedManufactureDate: formatDate(item.manufactureDate),
    formattedExpireDate: formatDate(item.expireDate),
    formattedReceivedDate: formatDate(item.receivedDate),
  };
}

function sortInventoryItems(items: InventoryViewModel[]) {
  return [...items].sort((left, right) => {
    const remainingDaysDiff = left.metrics.remainingDays - right.metrics.remainingDays;

    if (remainingDaysDiff !== 0) {
      return remainingDaysDiff;
    }

    return left.item.productName.localeCompare(right.item.productName, "zh-CN");
  });
}

function getCardColumnCount(containerWidth: number) {
  if (containerWidth <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor((containerWidth + CARD_GRID_GAP) / (CARD_MIN_WIDTH + CARD_GRID_GAP)));
}

function getCardPageSize(columnCount: number) {
  return Math.max(1, columnCount) * CARD_ROWS_PER_PAGE;
}

function getCardPlaceholderCount(itemCount: number, columnCount: number) {
  if (itemCount <= columnCount || columnCount <= 1) {
    return 0;
  }

  const remainder = itemCount % columnCount;
  return remainder === 0 ? 0 : columnCount - remainder;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    switch (error.message) {
      case "validation_error":
        return "请求参数不符合后端校验规则。";
      case "conflict":
        return "数据冲突，请检查批次或商品信息。";
      case "not_found":
        return "目标数据不存在。";
      default:
        return `请求失败：${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败，请稍后重试。";
}

function getErrorDebugDetail(error: unknown) {
  if (error instanceof ApiClientError) {
    return `ApiClientError: status=${error.status}, code=${error.code ?? "null"}, message=${error.message}`;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return JSON.stringify(error);
}

const InventoryOverviewCards = memo(function InventoryOverviewCards({ items }: { items: InventoryViewModel[] }) {
  const totalQuantity = items.reduce((sum, viewModel) => sum + viewModel.quantityValue, 0);
  const warningBatchCount = items.filter(
    (viewModel) =>
      viewModel.metrics.health !== "healthy" &&
      viewModel.item.expiryStatus !== "expired" &&
      viewModel.metrics.remainingDays >= 0,
  ).length;
  const expiredBatchCount = items.filter(
    (viewModel) => viewModel.item.expiryStatus === "expired" || viewModel.metrics.remainingDays < 0,
  ).length;
  const healthyRate = Math.round(
    (items.filter((viewModel) => viewModel.metrics.health === "healthy").length / Math.max(items.length, 1)) * 100,
  );

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="批次总数量"
        value={totalQuantity.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}
        trend="按批次汇总"
        trendType="up"
        icon={<Package size={24} />}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatCard
        title="临期批次"
        value={String(warningBatchCount)}
        trend="需优先关注"
        trendType="neutral"
        icon={<Clock3 size={24} className="text-amber-600" />}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-600"
      />
      <StatCard
        title="已过期批次"
        value={String(expiredBatchCount)}
        trend="需及时处理"
        trendType="critical"
        icon={<TriangleAlert size={24} />}
        iconBg="bg-red-500/10"
        iconColor="text-red-600"
      />
      <StatCard
        title="健康批次占比"
        value={`${healthyRate}%`}
        trend="效期安全率"
        trendType="up"
        icon={<ShieldCheck size={24} />}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-600"
      />
    </div>
  );
});

function NewBatchModal({
  open,
  form,
  submitting,
  selectedProduct,
  searchResults,
  error,
  onChange,
  onSelectProduct,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: NewBatchFormState;
  submitting: boolean;
  selectedProduct: Product | null;
  searchResults: Product[];
  error: string | null;
  onChange: (field: keyof NewBatchFormState, value: string) => void;
  onSelectProduct: (product: Product) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[3px]"
            onClick={submitting ? undefined : onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.section
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="ambient-shadow pointer-events-auto relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between border-b border-surface-container-high px-8 py-5">
                <div>
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">新增库存</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">选择货物并录入本次入库数量，后端会按库存入库权限校验。</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 px-8 py-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface">搜索货物</label>
                  <div className="relative">
                    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      value={form.query}
                      onChange={(event) => onChange("query", event.target.value)}
                      placeholder="按货物名、条码或厂商搜索"
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low py-3 pl-11 pr-12 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    {form.query ? (
                      <button
                        type="button"
                        onClick={() => onChange("query", "")}
                        className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white hover:text-primary"
                        aria-label="清空搜索"
                        title="清空搜索"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">候选货物</div>
                  <div
                    className="overflow-y-auto pr-1"
                    style={{ height: `${PRODUCT_OPTION_LIST_HEIGHT}px` }}
                  >
                      {searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {searchResults.map((product) => {
                            const selected = selectedProduct?.id === product.id;
                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => onSelectProduct(product)}
                                className={cn(
                                  "min-h-[84px] rounded-2xl border px-4 py-3 text-left transition-all",
                                  selected
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5",
                                )}
                              >
                                <div className="truncate font-bold text-on-surface">{product.product_name}</div>
                                <div className="mt-1 truncate text-xs text-on-surface-variant">{product.barcode}</div>
                                <div className="mt-1 truncate text-xs text-on-surface-variant">
                                  {product.manufacturer} · {product.location ?? "未分配库位"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-on-surface-variant">
                          未找到匹配货物。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-on-surface">数量 *</span>
                        <input
                          value={form.quantity}
                          onChange={(event) => onChange("quantity", event.target.value)}
                          placeholder="例如 8.50"
                          className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-on-surface">生产日期 *</span>
                        <input
                          type="date"
                          value={form.manufactureDate}
                          onChange={(event) => onChange("manufactureDate", event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                    </div>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-on-surface">备注</span>
                      <textarea
                        value={form.remarks}
                        onChange={(event) => onChange("remarks", event.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        placeholder="可选"
                      />
                    </label>

                    {selectedProduct ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        已选择：{selectedProduct.product_name} · 保质期 {selectedProduct.shelf_life_days} 天
                      </div>
                    ) : null}

                    {error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-surface-container-high pt-5">
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
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                    确认入库
                  </button>
                </div>
              </div>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

const InventoryCardView = memo(function InventoryCardView({
  items,
  columnCount,
  gridRef,
  onOpenDetail,
}: {
  items: InventoryViewModel[];
  columnCount: number;
  gridRef?: React.Ref<HTMLDivElement>;
  onOpenDetail: (item: InventoryRecord) => void;
}) {
  const placeholderCount = getCardPlaceholderCount(items.length, columnCount);

  return (
    <div
      ref={gridRef}
      className="grid auto-rows-fr gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))` }}
    >
      {items.map((viewModel) => {
        return (
          <InventoryStatusCard
            key={viewModel.item.id}
            item={viewModel.item}
            metrics={viewModel.metrics}
            meta={viewModel.meta}
            formattedQuantity={viewModel.formattedQuantity}
            formattedManufactureDate={viewModel.formattedManufactureDate}
            formattedExpireDate={viewModel.formattedExpireDate}
            formattedReceivedDate={viewModel.formattedReceivedDate}
            onOpenDetail={onOpenDetail}
          />
        );
      })}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <div
          key={`inventory-card-placeholder-${index}`}
          aria-hidden="true"
          className="pointer-events-none min-h-[312px] rounded-3xl border border-dashed border-slate-200/80 bg-slate-50/60 sm:min-h-[332px]"
        />
      ))}
    </div>
  );
});

const InventoryListView = memo(function InventoryListView({
  items,
  onOpenDetail,
}: {
  items: InventoryViewModel[];
  onOpenDetail: (item: InventoryRecord) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-container-low/50">
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">商品</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">供应商</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">库位</th>
            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">数量</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">生产日期</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">到期日期</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">剩余效期</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">收货日期</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-low">
          {items.map((viewModel) => {
            const { item, metrics, meta } = viewModel;
            return (
              <tr key={item.id} className="transition-colors hover:bg-surface-container-low/30">
                <td className="px-6 py-5">
                  <button type="button" onClick={() => onOpenDetail(item)} className="text-left">
                    <div className="font-bold text-on-surface transition-colors hover:text-primary">{item.productName}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">查看批次详情 · {item.category}</div>
                  </button>
                </td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{item.manufacturer}</td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{item.location}</td>
                <td className="px-6 py-5 text-center font-bold text-on-surface">{viewModel.formattedQuantity}</td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{viewModel.formattedManufactureDate}</td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{viewModel.formattedExpireDate}</td>
                <td className="px-6 py-5">
                  <div className="flex min-w-[180px] flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-on-surface-variant">
                      <span>{metrics.remainingDays} 天</span>
                      <span>{metrics.percent}%</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-slate-200">
                      <div className={cn("h-2 rounded-full transition-all", meta.progress)} style={{ width: `${metrics.percent}%` }} />
                    </div>
                    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", meta.tagClassName)}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{viewModel.formattedReceivedDate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

const ViewToggle = memo(function ViewToggle({
  view,
  onChange,
}: {
  view: InventoryView;
  onChange: (nextView: InventoryView) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
      <button
        type="button"
        onClick={() => onChange("card")}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
          view === "card" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary",
        )}
      >
        <LayoutGrid size={16} />
        卡片视图
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
          view === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary",
        )}
      >
        <List size={16} />
        列表视图
      </button>
    </div>
  );
});

export const InventoryStatusPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const canAddInventory = hasPermission("batch_operations_add");
  const canPrintLabel = hasPermission("label_payload_issue");
  const canSubmitLoss = hasPermission("batch_operations_loss");
  const [detail, setDetail] = useState<InventoryBatchDetail | null>(null);
  const [view, setView] = useState<InventoryView>("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [cardColumnCount, setCardColumnCount] = useState(1);
  const [selectedItem, setSelectedItem] = useState<InventoryRecord | null>(null);
  const [selectedDetailBatches, setSelectedDetailBatches] = useState<BatchDto[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isCreateBatchOpen, setIsCreateBatchOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newBatchError, setNewBatchError] = useState<string | null>(null);
  const [lossError, setLossError] = useState<string | null>(null);
  const [lossForm, setLossForm] = useState<LossFormState>(DEFAULT_LOSS_FORM);
  const [selectedLossCard, setSelectedLossCard] = useState<ProductLossCardData | null>(null);
  const [selectedLossBatchId, setSelectedLossBatchId] = useState<number | null>(null);
  const [newBatchForm, setNewBatchForm] = useState<NewBatchFormState>(DEFAULT_NEW_BATCH_FORM);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [labelPrintPayload, setLabelPrintPayload] = useState<LabelPrintPayload | null>(null);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);
  const [isLabelPrintLoading, setIsLabelPrintLoading] = useState(false);
  const [labelPrintError, setLabelPrintError] = useState<string | null>(null);
  const cardGridRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(newBatchForm.query);
  const pageSize = view === "card" ? getCardPageSize(cardColumnCount) : LIST_PAGE_SIZE;
  const productListParams = useMemo(
    () => ({
      search: deferredQuery.trim(),
      page: 1,
      size: 100,
    }),
    [deferredQuery],
  );
  const batchListParams = useMemo(() => ({ active_only: true, page: 1, size: BATCH_LIST_FETCH_SIZE }), []);
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(productListParams),
    queryFn: () => listProducts(productListParams),
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
  });
  const batchesQuery = useQuery({
    queryKey: queryKeys.batches.list(batchListParams),
    queryFn: () => listBatches(batchListParams),
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
  });
  const products = productsQuery.data?.items ?? [];
  const inventoryItems = useMemo(
    () =>
      batchesQuery.data?.items
        .filter((batch) => batch.status !== "used_up" && parseQuantity(batch.quantity) > 0)
        .map(toInventoryRecord) ?? [],
    [batchesQuery.data],
  );
  const isLoading = batchesQuery.isLoading || (!isCreateBatchOpen && productsQuery.isLoading);
  const pageError = productsQuery.error
    ? getErrorMessage(productsQuery.error)
    : batchesQuery.error
      ? getErrorMessage(batchesQuery.error)
      : null;

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const enrichedItems = useMemo(
    () => inventoryItems.map((item) => mergeInventoryRecord(item, productMap.get(item.productId))),
    [inventoryItems, productMap],
  );
  const inventoryViewModels = useMemo(() => enrichedItems.map(toInventoryViewModel), [enrichedItems]);
  const sortedItems = useMemo(() => sortInventoryItems(inventoryViewModels), [inventoryViewModels]);
  const selectedMetrics = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    return sortedItems.find((viewModel) => viewModel.item.id === selectedItem.id)?.metrics ?? getShelfLifeMetrics(selectedItem);
  }, [selectedItem, sortedItems]);
  const selectedLossProduct = selectedItem ? productMap.get(selectedItem.productId) ?? null : null;
  const batchSearchResults = useMemo(() => {
    if (!isCreateBatchOpen) {
      return [];
    }

    const query = deferredQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }
    const exactBarcode = products.find((product) => product.barcode.toLowerCase() === query);
    if (exactBarcode) {
      return [exactBarcode];
    }
    return products
      .filter((product) => {
        return (
          product.product_name.toLowerCase().includes(query) ||
          product.manufacturer.toLowerCase().includes(query) ||
          product.barcode.toLowerCase().includes(query)
        );
      });
  }, [deferredQuery, isCreateBatchOpen, products]);

  const activeBatchTotal = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(activeBatchTotal / pageSize));
  const pagedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const reloadPageData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.lists() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
  }, [queryClient]);

  const openDetail = useCallback(async (item: InventoryRecord) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetail(null);

    try {
      const product = productMap.get(item.productId) ?? null;
      const relatedBatchParams = { page: 1, size: 100 };
      const relatedBatches = await queryClient.fetchQuery({
        queryKey: queryKeys.batches.byProduct(item.productId, relatedBatchParams),
        queryFn: () => listProductBatches(item.productId, relatedBatchParams),
        staleTime: 5 * 60 * 1000,
      });
      const reportableBatches = relatedBatches.items.filter((batch) => batch.status !== "used_up" && parseQuantity(batch.quantity) > 0);
      setSelectedDetailBatches(reportableBatches);
      setDetail(
        buildInventoryDetail(
          product,
          reportableBatches,
        ),
      );
    } catch {
      setSelectedDetailBatches([]);
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, [productMap, queryClient]);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const openLossReportFromDetail = useCallback(() => {
    if (!canSubmitLoss) {
      notify.error({
        title: "无法发起报损",
        description: "当前账号没有提交报损的权限。",
      });
      return;
    }
    if (!selectedItem || !selectedLossProduct) {
      notify.error({
        title: "无法发起报损",
        description: "当前批次缺少货物信息，请刷新库存列表后重试。",
      });
      return;
    }

    const selectedBatchId = Number(selectedItem.id);
    const selectedBatch = selectedDetailBatches.find((batch) => batch.id === selectedBatchId);
    const reportableBatches = [
      ...(selectedBatch ? [selectedBatch] : []),
      ...selectedDetailBatches.filter((batch) => batch.id !== selectedBatchId),
    ];

    setSelectedLossCard({
      product: selectedLossProduct,
      batches: reportableBatches,
      totalQuantity: reportableBatches.reduce((sum, batch) => sum + parseQuantity(batch.quantity), 0),
      reportableBatchCount: reportableBatches.length,
    });
    setSelectedLossBatchId(selectedBatch?.id ?? reportableBatches[0]?.id ?? null);
    setLossForm(DEFAULT_LOSS_FORM);
    setLossError(null);
    setIsLossModalOpen(true);
  }, [canSubmitLoss, notify, selectedDetailBatches, selectedItem, selectedLossProduct]);

  const closeLossModal = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setIsLossModalOpen(false);
    setSelectedLossCard(null);
    setSelectedLossBatchId(null);
    setLossForm(DEFAULT_LOSS_FORM);
    setLossError(null);
  }, [isSubmitting]);

  const handleLossFormChange = useCallback((field: keyof LossFormState, value: string) => {
    setLossForm((currentForm) => ({ ...currentForm, [field]: value }));
    setLossError(null);
  }, []);

  const handleSubmitLoss = useCallback(async () => {
    if (!canSubmitLoss) {
      setLossError("当前账号没有提交报损的权限。");
      return;
    }
    if (!selectedLossCard || !selectedLossBatchId) {
      setLossError("请先选择一个可报损批次。");
      return;
    }

    const selectedBatch = selectedLossCard.batches.find((batch) => batch.id === selectedLossBatchId);
    if (!selectedBatch) {
      setLossError("目标批次不存在，请重新选择。");
      return;
    }

    const quantityValue = Number.parseFloat(lossForm.quantity);
    const availableQuantity = parseQuantity(selectedBatch.quantity);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setLossError("请输入有效的报损数量。");
      return;
    }

    if (quantityValue > availableQuantity) {
      setLossError(`报损数量不能超过当前批次的可用数量 ${formatQuantity(String(availableQuantity))}。`);
      return;
    }

    setIsSubmitting(true);
    setLossError(null);

    try {
      await createBatchOperation(selectedLossBatchId, {
        operation_type: "loss",
        quantity: lossForm.quantity.trim(),
        remarks: lossForm.remarks.trim() || null,
      });
      await reloadPageData();
      await queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.batches.product(selectedLossCard.product.id) });
      notify.success({
        title: "报损提交成功",
        description: `已为批次 ${selectedBatch.batch_code} 记录报损，库存列表会自动同步最新结果。`,
      });
      closeLossModal();
      closeDetail();
    } catch (error) {
      setLossError(getErrorMessage(error));
      notify.error({
        title: "报损提交失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmitLoss,
    closeDetail,
    closeLossModal,
    lossForm.quantity,
    lossForm.remarks,
    notify,
    queryClient,
    reloadPageData,
    selectedLossBatchId,
    selectedLossCard,
  ]);

  const openLabelPrint = useCallback(async () => {
    if (!canPrintLabel) {
      setLabelPrintError("当前账号没有签发标签凭证的权限。");
      return;
    }
    if (!selectedItem) {
      return;
    }

    const batchId = Number(selectedItem.id);
    setIsLabelPrintOpen(true);
    setIsLabelPrintLoading(true);
    setLabelPrintError(null);
    setLabelPrintPayload(null);

    if (!Number.isFinite(batchId)) {
      setLabelPrintError("当前批次 ID 无效，无法加载二维码凭证。");
      setIsLabelPrintLoading(false);
      return;
    }

    try {
      const payload = await queryClient.fetchQuery({
        queryKey: queryKeys.batches.labelPayload(batchId),
        queryFn: () => getBatchLabelPayload(batchId),
        staleTime: 60 * 1000,
      });

      setLabelPrintPayload({
        productName: payload.productName,
        barcode: payload.barcode,
        batchCode: payload.batchCode,
        quantity: payload.quantity ?? formatQuantity(selectedItem.quantity),
        category: selectedItem.category || "未分类",
        location: payload.location ?? selectedItem.location ?? "未分配库位",
        manufacturer: selectedItem.manufacturer,
        manufactureDate: formatDate(selectedItem.manufactureDate),
        expireDate: payload.expireDate ?? "-",
        receivedDate: formatDate(selectedItem.receivedDate),
        statusLabel:
          selectedItem.expiryStatus === "expired"
            ? "已过期"
            : selectedMetrics?.health === "critical" || selectedMetrics?.health === "warning"
              ? "临期"
                : "效期健康",
        qrCode: payload.qrCode,
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setLabelPrintError("后端二维码凭证签发失败（409 conflict）。请确认后端已创建 batch_qr_credentials 表并完成二维码审计相关数据库初始化。");
      } else {
        setLabelPrintError(getErrorMessage(error));
      }
    } finally {
      setIsLabelPrintLoading(false);
    }
  }, [canPrintLabel, queryClient, selectedItem, selectedMetrics]);

  const closeLabelPrint = useCallback(() => {
    setIsLabelPrintOpen(false);
  }, []);

  const openCreateBatchModal = useCallback(() => {
    if (!canAddInventory) {
      return;
    }
    setIsCreateBatchOpen(true);
    setSelectedProduct(null);
    setNewBatchError(null);
    setNewBatchForm(DEFAULT_NEW_BATCH_FORM);
  }, [canAddInventory]);

  const closeCreateBatchModal = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setIsCreateBatchOpen(false);
    setSelectedProduct(null);
    setNewBatchError(null);
    setNewBatchForm(DEFAULT_NEW_BATCH_FORM);
  }, [isSubmitting]);

  const handleNewBatchChange = useCallback((field: keyof NewBatchFormState, value: string) => {
    setNewBatchForm((currentForm) => ({ ...currentForm, [field]: value }));
    setNewBatchError(null);
  }, []);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setNewBatchError(null);
    setNewBatchForm((currentForm) => ({
      ...currentForm,
      query: product.barcode || product.product_name,
    }));
  }, []);

  const handleCreateBatch = useCallback(async () => {
    if (!canAddInventory) {
      setNewBatchError("当前账号没有库存入库权限。");
      return;
    }
    if (!selectedProduct) {
      setNewBatchError("请先选择一个货物。");
      return;
    }
    if (!newBatchForm.quantity.trim() || Number.parseFloat(newBatchForm.quantity) <= 0) {
      setNewBatchError("请输入有效数量。");
      return;
    }
    if (!newBatchForm.manufactureDate) {
      setNewBatchError("请选择生产日期。");
      return;
    }

    setIsSubmitting(true);
    setNewBatchError(null);

    try {
      const batch = await createBatch({
        product_id: selectedProduct.id,
        manufacture_date: newBatchForm.manufactureDate,
        remarks: newBatchForm.remarks.trim() || null,
      });
      await createBatchOperation(batch.id, {
        operation_type: "add",
        quantity: newBatchForm.quantity.trim(),
        remarks: newBatchForm.remarks.trim() || null,
      });
      await reloadPageData();
      await queryClient.invalidateQueries({ queryKey: queryKeys.batches.product(selectedProduct.id) });
      notify.success({
        title: "库存入库成功",
        description: `已为 ${selectedProduct.product_name} 记录本次入库，库存列表会自动同步最新结果。`,
      });
      setIsCreateBatchOpen(false);
      setSelectedProduct(null);
      setNewBatchForm(DEFAULT_NEW_BATCH_FORM);
    } catch (error) {
      setNewBatchError(getErrorMessage(error));
      notify.error({
        title: "库存入库失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [canAddInventory, newBatchForm.manufactureDate, newBatchForm.quantity, newBatchForm.remarks, notify, queryClient, reloadPageData, selectedProduct]);

  useEffect(() => {
    if (!isDetailOpen) {
      const timer = window.setTimeout(() => {
        setSelectedItem(null);
        setDetail(null);
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [isDetailOpen]);

  useEffect(() => {
    if (view !== "card" || isLoading) {
      return;
    }

    const container = cardGridRef.current;
    if (!container) {
      return;
    }

    const updatePageSize = () => {
      const nextColumnCount = getCardColumnCount(container.clientWidth);
      setCardColumnCount((previousColumnCount) => (previousColumnCount === nextColumnCount ? previousColumnCount : nextColumnCount));
    };

    updatePageSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updatePageSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isLoading, view]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">库存状态</h2>
          <p className="mt-1 text-on-surface-variant">查看批次库存、效期状态，并通过库存入库权限控制新增库存入口。</p>
        </div>
        {canAddInventory ? (
          <button
            type="button"
            onClick={openCreateBatchModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus size={18} />
            新增库存
          </button>
        ) : null}
      </div>

      {pageError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">{pageError}</div>
      ) : null}

      <InventoryOverviewCards items={inventoryViewModels} />

      <section className="ambient-shadow overflow-hidden rounded-3xl border border-surface-container/10 bg-surface-container-lowest">
        <div className="flex flex-col gap-4 border-b border-surface-container-high p-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">批次详情</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {isLoading ? "正在从后端加载批次..." : `当前共 ${activeBatchTotal} 个有效库存批次，当前页临期与过期批次优先展示。`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 md:flex">
              {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
              接口来源：`/api/batches`
            </div>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        <div className="p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
              <LoaderCircle size={28} className="animate-spin text-on-surface-variant" />
              <div>
                <h4 className="text-lg font-bold text-on-surface">正在同步批次数据</h4>
                <p className="mt-1 text-sm text-on-surface-variant">请确认 Django 服务已启动，并且 `VITE_API_BASE_URL` 指向正确后端。</p>
              </div>
            </div>
          ) : view === "card" ? (
            <InventoryCardView items={pagedItems} columnCount={cardColumnCount} gridRef={cardGridRef} onOpenDetail={openDetail} />
          ) : (
            <InventoryListView items={pagedItems} onOpenDetail={openDetail} />
          )}
        </div>

        {!isLoading ? (
          <div className="px-8 pb-8">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        ) : null}
      </section>

      <InventoryBatchDetailModal
        open={isDetailOpen && !isDetailLoading && Boolean(detail)}
        item={selectedItem}
        detail={detail}
        metrics={selectedMetrics}
        canPrintLabel={canPrintLabel}
        canSubmitLoss={canSubmitLoss}
        onClose={closeDetail}
        onPrintLabel={openLabelPrint}
        onOpenLossReport={openLossReportFromDetail}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        formatQuantity={formatQuantity}
      />

      <LossReportModal
        open={isLossModalOpen}
        card={selectedLossCard}
        selectedBatchId={selectedLossBatchId}
        form={lossForm}
        submitting={isSubmitting}
        error={lossError}
        onClose={closeLossModal}
        onSelectBatch={(batchId) => {
          setSelectedLossBatchId(batchId);
          setLossError(null);
        }}
        onChange={handleLossFormChange}
        onSubmit={handleSubmitLoss}
      />

      <LabelPrintModal
        open={isLabelPrintOpen}
        payload={labelPrintPayload}
        loading={isLabelPrintLoading}
        error={labelPrintError}
        onClose={closeLabelPrint}
        onRetry={openLabelPrint}
      />

      {isDetailOpen && isDetailLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-lg">
            <div className="flex items-center gap-3">
              <LoaderCircle size={18} className="animate-spin" />
              正在加载批次详情...
            </div>
          </div>
        </div>
      ) : null}

      <NewBatchModal
        open={isCreateBatchOpen}
        form={newBatchForm}
        submitting={isSubmitting}
        selectedProduct={selectedProduct}
        searchResults={batchSearchResults}
        error={newBatchError}
        onChange={handleNewBatchChange}
        onSelectProduct={handleSelectProduct}
        onClose={closeCreateBatchModal}
        onSubmit={handleCreateBatch}
      />

      <FloatingActionButtons />
    </>
  );
};
