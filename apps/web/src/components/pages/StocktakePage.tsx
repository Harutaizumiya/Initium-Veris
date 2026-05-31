import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  LoaderCircle,
  PackagePlus,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiClientError,
  approveStocktake,
  cancelStocktake,
  countStocktakeItem,
  createStocktake,
  getStocktake,
  listBatches,
  listProducts,
  listStocktakes,
  parseQuantity,
  queryKeys,
  startStocktake,
  submitStocktake,
  updateStocktakeScope,
  type BatchDto,
  type Product,
  type StocktakeItemDto,
  type StocktakeTaskDto,
  type StocktakeTaskStatus,
  type StocktakeTaskType,
} from "../../api";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { OperationAlert, type OperationAlertType } from "../common/OperationAlert";

const PAGE_SIZE = 20;
const OPTION_PAGE_SIZE = 100;

const taskTypeLabels: Record<StocktakeTaskType, string> = {
  daily: "日盘",
  weekly: "周盘",
  monthly: "月盘",
};

const statusLabels: Record<StocktakeTaskStatus, string> = {
  draft: "草稿",
  active: "进行中",
  submitted: "待复核",
  approved: "已完成",
  cancelled: "已取消",
};

const statusClassNames: Record<StocktakeTaskStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  active: "border-primary/20 bg-primary/5 text-primary",
  submitted: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-600",
};

interface FeedbackState {
  type: OperationAlertType;
  title: string;
  description: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    switch (error.message) {
      case "validation_error":
        return "请求参数不符合后端校验规则。";
      case "conflict":
        return "当前盘点状态不允许执行该操作，或审批调整会导致库存为负。";
      case "not_found":
        return "目标盘点任务或盘点项不存在。";
      default:
        return `请求失败：${error.message}`;
    }
  }
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQuantity(value: string | number | null) {
  const numericValue = typeof value === "number" ? value : parseQuantity(value ?? "0");
  return numericValue.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function differenceClassName(value: string | null) {
  const numericValue = parseQuantity(value ?? "0");
  if (numericValue > 0) {
    return "text-emerald-700";
  }
  if (numericValue < 0) {
    return "text-red-600";
  }
  return "text-on-surface";
}

function filterItems(items: StocktakeItemDto[], query: string, reviewFilter: "all" | "gain" | "loss" | "pending") {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.product.product_name.toLowerCase().includes(normalizedQuery) ||
      item.product.barcode.toLowerCase().includes(normalizedQuery) ||
      item.batch.batch_code.toLowerCase().includes(normalizedQuery);
    const difference = parseQuantity(item.difference_quantity ?? "0");
    const matchesReview =
      reviewFilter === "all" ||
      (reviewFilter === "gain" && difference > 0) ||
      (reviewFilter === "loss" && difference < 0) ||
      (reviewFilter === "pending" && item.status === "pending");
    return matchesQuery && matchesReview;
  });
}

function StatusBadge({ status }: { status: StocktakeTaskStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-bold", statusClassNames[status])}>
      {statusLabels[status]}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3">
      <div className="text-xs font-bold text-on-surface-variant">{label}</div>
      <div className="mt-1 font-headline text-xl font-extrabold text-on-surface">{value}</div>
    </div>
  );
}

function CreateTaskModal({
  open,
  products,
  submitting,
  error,
  onClose,
  onCreate,
}: {
  open: boolean;
  products: Product[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (taskType: StocktakeTaskType, scopeConfig: Record<string, unknown>) => void;
}) {
  const [taskType, setTaskType] = useState<StocktakeTaskType>("daily");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [productId, setProductId] = useState("");

  useEffect(() => {
    if (!open) {
      setTaskType("daily");
      setCategory("");
      setLocation("");
      setProductId("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).sort();
  const locations = Array.from(new Set(products.map((product) => product.location).filter(Boolean) as string[])).sort();

  const submit = () => {
    const scopeConfig: Record<string, unknown> = {};
    if (category) {
      scopeConfig.categories = [category];
    }
    if (location) {
      scopeConfig.locations = [location];
    }
    if (productId) {
      scopeConfig.product_ids = [Number(productId)];
    }
    onCreate(taskType, scopeConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[3px]">
      <section className="ambient-shadow w-full max-w-3xl overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest">
        <div className="flex items-start justify-between border-b border-surface-container-high px-8 py-6">
          <div>
            <h3 className="font-headline text-2xl font-extrabold text-on-surface">创建盘点任务</h3>
            <p className="mt-1 text-sm text-on-surface-variant">系统按类型生成默认范围，创建后可进入盘点内容确认。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-container text-on-surface-variant hover:text-primary"
            aria-label="关闭"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 px-8 py-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">盘点类型</span>
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value as StocktakeTaskType)}
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {Object.entries(taskTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">指定商品</span>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">不指定</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">指定分类</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">不指定</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">指定库位</span>
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">不指定</option>
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <div className="mx-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        <div className="flex justify-end gap-3 border-t border-surface-container-high px-8 py-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-surface-container px-5 py-3 text-sm font-bold">
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-container disabled:opacity-60"
          >
            {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
            创建任务
          </button>
        </div>
      </section>
    </div>
  );
}

function ScopeControls({
  task,
  products,
  batches,
  submitting,
  onAdd,
  onRemove,
  onStart,
}: {
  task: StocktakeTaskDto;
  products: Product[];
  batches: BatchDto[];
  submitting: boolean;
  onAdd: (input: { add_batch_ids?: number[]; add_product_ids?: number[]; add_categories?: string[]; add_locations?: string[]; add_expiry_statuses?: string[]; add_recent_changes_days?: number }) => void;
  onRemove: (batchId: number) => void;
  onStart: () => void;
}) {
  const [batchId, setBatchId] = useState("");
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const canRemove = task.status === "draft";
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).sort();
  const locations = Array.from(new Set(products.map((product) => product.location).filter(Boolean) as string[])).sort();

  return (
    <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="font-headline text-xl font-bold text-on-surface">盘点内容确认</h3>
          <p className="mt-1 text-sm text-on-surface-variant">草稿可添加或移除批次；进行中只允许补充盘点项。</p>
        </div>
        {task.status === "draft" ? (
          <button
            type="button"
            onClick={onStart}
            disabled={submitting || task.stats.total_items === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-container disabled:opacity-60"
          >
            <Play size={16} />
            开始盘点
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm">
          <option value="">选择批次</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_code} · {batch.product.product_name}
            </option>
          ))}
        </select>
        <select value={productId} onChange={(event) => setProductId(event.target.value)} className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm">
          <option value="">按商品加入</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.product_name}
            </option>
          ))}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm">
          <option value="">按分类加入</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm">
          <option value="">按库位加入</option>
          {locations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            const input = {
              ...(batchId ? { add_batch_ids: [Number(batchId)] } : {}),
              ...(productId ? { add_product_ids: [Number(productId)] } : {}),
              ...(category ? { add_categories: [category] } : {}),
              ...(location ? { add_locations: [location] } : {}),
            };
            onAdd(input);
          }}
          disabled={submitting || (!batchId && !productId && !category && !location)}
          className="inline-flex items-center gap-2 rounded-2xl border border-surface-container bg-white px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          <PackagePlus size={16} />
          加入选中范围
        </button>
        <button type="button" onClick={() => onAdd({ add_expiry_statuses: ["warning", "critical", "expired"] })} className="rounded-2xl border border-surface-container px-4 py-3 text-sm font-bold">
          加入临期/过期
        </button>
        <button type="button" onClick={() => onAdd({ add_recent_changes_days: 7 })} className="rounded-2xl border border-surface-container px-4 py-3 text-sm font-bold">
          加入最近变动
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-surface-container">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface-container-high text-xs font-bold text-on-surface-variant">
            <tr>
              <th className="px-5 py-4">商品</th>
              <th className="px-5 py-4">批次</th>
              <th className="px-5 py-4">分类 / 库位</th>
              <th className="px-5 py-4 text-right">快照数量</th>
              <th className="px-5 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {task.items?.map((item) => (
              <tr key={item.id} className="hover:bg-surface-container-low">
                <td className="px-5 py-4 font-semibold text-on-surface">{item.product.product_name}</td>
                <td className="px-5 py-4 text-on-surface-variant">{item.batch.batch_code}</td>
                <td className="px-5 py-4 text-on-surface-variant">
                  {item.product.category || "未分类"} / {item.product.location || "未分配库位"}
                </td>
                <td className="px-5 py-4 text-right font-semibold">{formatQuantity(item.snapshot_quantity)}</td>
                <td className="px-5 py-4 text-right">
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(item.batch_id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                      aria-label="移除"
                      title="移除"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span className="text-xs text-on-surface-variant">已锁定</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItemTable({
  task,
  query,
  reviewFilter,
  countedDrafts,
  remarksDrafts,
  submitting,
  onChangeQuery,
  onChangeReviewFilter,
  onChangeCount,
  onChangeRemarks,
  onSaveCount,
}: {
  task: StocktakeTaskDto;
  query: string;
  reviewFilter: "all" | "gain" | "loss" | "pending";
  countedDrafts: Record<number, string>;
  remarksDrafts: Record<number, string>;
  submitting: boolean;
  onChangeQuery: (value: string) => void;
  onChangeReviewFilter: (value: "all" | "gain" | "loss" | "pending") => void;
  onChangeCount: (itemId: number, value: string) => void;
  onChangeRemarks: (itemId: number, value: string) => void;
  onSaveCount: (item: StocktakeItemDto) => void;
}) {
  const items = filterItems(task.items ?? [], query, reviewFilter);
  const canCount = task.status === "active";

  return (
    <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="font-headline text-xl font-bold text-on-surface">{canCount ? "盘点执行" : "差异复核"}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">搜索商品、条码或批次号，核对系统快照与实盘差异。</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative min-w-[280px]">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={query}
              onChange={(event) => onChangeQuery(event.target.value)}
              placeholder="搜索商品、条码、批次"
              className="w-full rounded-2xl border border-surface-container bg-surface-container-low py-3 pl-11 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <select
            value={reviewFilter}
            onChange={(event) => onChangeReviewFilter(event.target.value as "all" | "gain" | "loss" | "pending")}
            className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm"
          >
            <option value="all">全部</option>
            <option value="gain">只看盘盈</option>
            <option value="loss">只看盘亏</option>
            <option value="pending">只看未盘</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-surface-container">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-surface-container-high text-xs font-bold text-on-surface-variant">
            <tr>
              <th className="px-5 py-4">商品</th>
              <th className="px-5 py-4">批次</th>
              <th className="px-5 py-4 text-right">快照</th>
              <th className="px-5 py-4 text-right">实盘</th>
              <th className="px-5 py-4 text-right">差异</th>
              <th className="px-5 py-4">备注</th>
              <th className="px-5 py-4 text-right">状态</th>
              {canCount ? <th className="px-5 py-4 text-right">操作</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {items.map((item) => {
              const countedValue = countedDrafts[item.id] ?? item.counted_quantity ?? "";
              const remarksValue = remarksDrafts[item.id] ?? item.remarks ?? "";
              return (
                <tr key={item.id} className="hover:bg-surface-container-low">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-on-surface">{item.product.product_name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{item.product.barcode}</div>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{item.batch.batch_code}</td>
                  <td className="px-5 py-4 text-right font-semibold">{formatQuantity(item.snapshot_quantity)}</td>
                  <td className="px-5 py-4 text-right">
                    {canCount ? (
                      <input
                        value={countedValue}
                        onChange={(event) => onChangeCount(item.id, event.target.value)}
                        className="w-28 rounded-xl border border-surface-container bg-white px-3 py-2 text-right outline-none focus:border-primary"
                      />
                    ) : (
                      <span className="font-semibold">{formatQuantity(item.counted_quantity)}</span>
                    )}
                  </td>
                  <td className={cn("px-5 py-4 text-right font-bold", differenceClassName(item.difference_quantity))}>
                    {item.difference_quantity ? formatQuantity(item.difference_quantity) : "-"}
                  </td>
                  <td className="px-5 py-4">
                    {canCount ? (
                      <input
                        value={remarksValue}
                        onChange={(event) => onChangeRemarks(item.id, event.target.value)}
                        className="w-48 rounded-xl border border-surface-container bg-white px-3 py-2 outline-none focus:border-primary"
                      />
                    ) : (
                      <span className="text-on-surface-variant">{item.remarks || "-"}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-xs font-bold text-on-surface-variant">{item.status}</td>
                  {canCount ? (
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        disabled={submitting || !countedValue}
                        onClick={() => onSaveCount(item)}
                        className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-container disabled:opacity-50"
                      >
                        保存
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StocktakePage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filters, setFilters] = useState<{ task_type: "" | StocktakeTaskType; status: "" | StocktakeTaskStatus }>({
    task_type: "",
    status: "",
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "gain" | "loss" | "pending">("all");
  const [countedDrafts, setCountedDrafts] = useState<Record<number, string>>({});
  const [remarksDrafts, setRemarksDrafts] = useState<Record<number, string>>({});
  const [approvalRemarks, setApprovalRemarks] = useState("");

  const canCreate = hasPermission("stocktakes_create");
  const canUpdateScope = hasPermission("stocktakes_update_scope");
  const canCount = hasPermission("stocktakes_count");
  const canSubmit = hasPermission("stocktakes_submit");
  const canApprove = hasPermission("stocktakes_approve");
  const canCancel = hasPermission("stocktakes_cancel");

  const listParams = {
    ...(filters.task_type ? { task_type: filters.task_type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    page: 1,
    size: PAGE_SIZE,
  };

  const tasksQuery = useQuery({
    queryKey: queryKeys.stocktakes.list(listParams),
    queryFn: () => listStocktakes(listParams),
  });

  const detailQuery = useQuery({
    queryKey: selectedTaskId ? queryKeys.stocktakes.detail(selectedTaskId) : ["stocktakes", "empty"],
    queryFn: () => getStocktake(selectedTaskId as number),
    enabled: selectedTaskId !== null,
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list({ page: 1, size: OPTION_PAGE_SIZE }),
    queryFn: () => listProducts({ page: 1, size: OPTION_PAGE_SIZE }),
    staleTime: 5 * 60 * 1000,
  });

  const batchesQuery = useQuery({
    queryKey: queryKeys.batches.list({ page: 1, size: OPTION_PAGE_SIZE }),
    queryFn: () => listBatches({ page: 1, size: OPTION_PAGE_SIZE }),
    staleTime: 60 * 1000,
  });

  const tasks = tasksQuery.data?.items ?? [];
  const selectedTask = detailQuery.data ?? null;
  const products = productsQuery.data?.items ?? [];
  const batches = batchesQuery.data?.items ?? [];

  useEffect(() => {
    if (selectedTaskId || tasks.length === 0) {
      return;
    }
    setSelectedTaskId(tasks[0].id);
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    setCountedDrafts({});
    setRemarksDrafts({});
    setQuery("");
    setReviewFilter("all");
    setApprovalRemarks("");
  }, [selectedTaskId]);

  const pageError = tasksQuery.error ? getErrorMessage(tasksQuery.error) : detailQuery.error ? getErrorMessage(detailQuery.error) : null;

  const reloadStocktakes = async (taskId = selectedTaskId) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.stocktakes.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.operations.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
    if (taskId) {
      setSelectedTaskId(taskId);
    }
  };

  const runOperation = async (action: () => Promise<StocktakeTaskDto | StocktakeItemDto>, success: FeedbackState) => {
    setSubmitting(true);
    setOperationError(null);
    try {
      const result = await action();
      await reloadStocktakes("task_type" in result ? result.id : selectedTaskId);
      setFeedback(success);
    } catch (error) {
      setOperationError(getErrorMessage(error));
      setFeedback({ type: "error", title: "操作失败", description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (taskType: StocktakeTaskType, scopeConfig: Record<string, unknown>) => {
    setSubmitting(true);
    setCreateError(null);
    try {
      const task = await createStocktake({ task_type: taskType, scope_config: scopeConfig });
      setSelectedTaskId(task.id);
      setIsCreateOpen(false);
      await reloadStocktakes(task.id);
      setFeedback({ type: "success", title: "盘点任务已创建", description: `已生成 ${task.stats.total_items} 个默认盘点项。` });
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCount = (item: StocktakeItemDto) => {
    if (!selectedTask) {
      return;
    }
    const countedQuantity = countedDrafts[item.id] ?? item.counted_quantity ?? "";
    if (!countedQuantity || Number.parseFloat(countedQuantity) < 0) {
      setOperationError("请输入有效的实盘数量。");
      return;
    }
    void runOperation(
      () =>
        countStocktakeItem(selectedTask.id, item.id, {
          counted_quantity: countedQuantity,
          remarks: remarksDrafts[item.id] ?? item.remarks ?? null,
        }),
      { type: "success", title: "实盘数量已保存", description: `批次 ${item.batch.batch_code} 的差异已重新计算。` },
    );
  };

  const headerStats = useMemo(() => selectedTask?.stats, [selectedTask]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">库存盘点</h2>
          <p className="mt-1 text-on-surface-variant">创建盘点任务、确认盘点范围、录入实盘数量并审批生成库存调整流水。</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-container"
          >
            <Plus size={18} />
            创建盘点任务
          </button>
        ) : null}
      </div>

      {pageError ? <div className="mb-6"><OperationAlert type="error" title="盘点数据加载失败" description={pageError} showIcon /></div> : null}
      {operationError ? <div className="mb-6"><OperationAlert type="error" title="操作未完成" description={operationError} showIcon /></div> : null}
      {feedback ? <div className="mb-6"><OperationAlert type={feedback.type} title={feedback.title} description={feedback.description} showIcon closable /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-5 ambient-shadow">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-headline text-lg font-bold text-on-surface">任务列表</h3>
            {tasksQuery.isLoading ? <LoaderCircle size={18} className="animate-spin text-primary" /> : null}
          </div>
          <div className="mt-4 grid gap-3">
            <select
              value={filters.task_type}
              onChange={(event) => setFilters((current) => ({ ...current, task_type: event.target.value as "" | StocktakeTaskType }))}
              className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm"
            >
              <option value="">全部类型</option>
              {Object.entries(taskTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as "" | StocktakeTaskStatus }))}
              className="rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm"
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTaskId(task.id)}
                className={cn(
                  "rounded-3xl border p-4 text-left transition-colors",
                  selectedTaskId === task.id ? "border-primary bg-primary/5" : "border-surface-container hover:bg-surface-container-low",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-headline text-base font-bold text-on-surface">#{task.id} {taskTypeLabels[task.task_type]}</div>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
                  <span>创建人：{task.created_by?.display ?? "-"}</span>
                  <span>进度：{Math.round(task.stats.progress * 100)}%</span>
                  <span>差异项：{task.stats.difference_items}</span>
                  <span>{formatDateTime(task.created_at)}</span>
                </div>
              </button>
            ))}
            {!tasksQuery.isLoading && tasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-surface-container px-5 py-10 text-center text-sm text-on-surface-variant">
                暂无盘点任务。
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          {selectedTask ? (
            <>
              <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-headline text-2xl font-extrabold text-on-surface">#{selectedTask.id} {taskTypeLabels[selectedTask.task_type]}</h3>
                      <StatusBadge status={selectedTask.status} />
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      创建于 {formatDateTime(selectedTask.created_at)}，创建人 {selectedTask.created_by?.display ?? "-"}。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {selectedTask.status === "active" && canSubmit ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void runOperation(() => submitStocktake(selectedTask.id), {
                            type: "success",
                            title: "盘点已提交",
                            description: "任务已进入复核阶段。",
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
                      >
                        <Send size={16} />
                        提交复核
                      </button>
                    ) : null}
                    {selectedTask.status === "submitted" && canApprove ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void runOperation(() => approveStocktake(selectedTask.id, { remarks: approvalRemarks }), {
                            type: "success",
                            title: "盘点已审批",
                            description: "系统已为差异项生成库存调整流水。",
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                      >
                        <ShieldCheck size={16} />
                        审批确认
                      </button>
                    ) : null}
                    {["draft", "active", "submitted"].includes(selectedTask.status) && canCancel ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void runOperation(() => cancelStocktake(selectedTask.id, { remarks: "用户取消" }), {
                            type: "warning",
                            title: "盘点已取消",
                            description: "任务记录已保留，不会物理删除。",
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
                      >
                        <X size={16} />
                        取消任务
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <Metric label="盘点项" value={String(headerStats?.total_items ?? 0)} />
                  <Metric label="已盘" value={String(headerStats?.counted_items ?? 0)} />
                  <Metric label="未盘" value={String(headerStats?.pending_items ?? 0)} />
                  <Metric label="需复盘" value={String(headerStats?.recount_items ?? 0)} />
                  <Metric label="差异项" value={String(headerStats?.difference_items ?? 0)} />
                  <Metric label="差异合计" value={formatQuantity(headerStats?.total_difference_quantity ?? "0")} />
                </div>
              </section>

              {(selectedTask.status === "draft" || selectedTask.status === "active") && canUpdateScope ? (
                <ScopeControls
                  task={selectedTask}
                  products={products}
                  batches={batches}
                  submitting={submitting}
                  onAdd={(input) =>
                    void runOperation(() => updateStocktakeScope(selectedTask.id, input), {
                      type: "success",
                      title: "盘点范围已更新",
                      description: "盘点清单已按所选条件补充。",
                    })
                  }
                  onRemove={(batchId) =>
                    void runOperation(() => updateStocktakeScope(selectedTask.id, { remove_batch_ids: [batchId] }), {
                      type: "success",
                      title: "盘点项已移除",
                      description: "草稿盘点清单已更新。",
                    })
                  }
                  onStart={() =>
                    void runOperation(() => startStocktake(selectedTask.id), {
                      type: "success",
                      title: "盘点已开始",
                      description: "现在可以录入实盘数量。",
                    })
                  }
                />
              ) : null}

              {selectedTask.status === "submitted" ? (
                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-amber-950">复核意见</span>
                    <textarea
                      value={approvalRemarks}
                      onChange={(event) => setApprovalRemarks(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary"
                      placeholder="填写审批意见，确认后会生成 adjust 库存调整流水"
                    />
                  </label>
                </section>
              ) : null}

              {selectedTask.status !== "draft" ? (
                <ItemTable
                  task={selectedTask}
                  query={query}
                  reviewFilter={reviewFilter}
                  countedDrafts={countedDrafts}
                  remarksDrafts={remarksDrafts}
                  submitting={submitting || !canCount}
                  onChangeQuery={setQuery}
                  onChangeReviewFilter={setReviewFilter}
                  onChangeCount={(itemId, value) => setCountedDrafts((current) => ({ ...current, [itemId]: value }))}
                  onChangeRemarks={(itemId, value) => setRemarksDrafts((current) => ({ ...current, [itemId]: value }))}
                  onSaveCount={handleSaveCount}
                />
              ) : null}

              {selectedTask.status === "approved" ? (
                <OperationAlert
                  type="success"
                  title="盘点已完成"
                  description="任务已完成审批，非零差异项已生成 signed adjust 库存调整流水。"
                  showIcon
                />
              ) : null}
            </>
          ) : (
            <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-surface-container bg-surface-container-lowest p-8 text-center">
              <ClipboardCheck size={40} className="text-on-surface-variant" />
              <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">选择或创建盘点任务</h3>
              <p className="mt-2 text-sm text-on-surface-variant">任务会先进入草稿阶段，确认盘点内容后再开始录入实盘数量。</p>
              <button
                type="button"
                onClick={() => setFilters({ task_type: "", status: "" })}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-surface-container px-4 py-3 text-sm font-bold"
              >
                <RotateCcw size={16} />
                重置筛选
              </button>
            </section>
          )}
        </div>
      </div>

      <CreateTaskModal
        open={isCreateOpen}
        products={products}
        submitting={submitting}
        error={createError}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
