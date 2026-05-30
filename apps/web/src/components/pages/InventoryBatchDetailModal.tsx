import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Barcode,
  BarChart3,
  CheckCircle2,
  Droplets,
  Layers,
  Package2,
  Printer,
  Thermometer,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type {
  InventoryBatchDetailModalProps,
  ExpiryStatus,
  InventoryHealth,
  InventoryRelatedBatch,
  InventoryStorageRequirement,
} from "./InventoryStatus.types";

function getStatusMeta(health: InventoryHealth, expiryStatus?: ExpiryStatus | null) {
  if (expiryStatus === "expired") {
    return {
      badgeClassName: "bg-red-50 text-red-600 border-red-200",
      progressClassName: "bg-red-600",
      textClassName: "text-red-600",
      icon: <AlertTriangle size={14} className="text-red-600" />,
      label: "已过期",
    };
  }

  if (health === "critical") {
    return {
      badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
      progressClassName: "bg-amber-500",
      textClassName: "text-amber-700",
      icon: <AlertTriangle size={14} className="text-amber-600" />,
      label: "临期",
    };
  }

  if (health === "warning") {
    return {
      badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
      progressClassName: "bg-amber-400",
      textClassName: "text-amber-700",
      icon: <AlertTriangle size={14} className="text-amber-600" />,
      label: "临期",
    };
  }

  return {
    badgeClassName: "bg-emerald-50 text-emerald-600 border-emerald-200",
    progressClassName: "bg-emerald-500",
    textClassName: "text-emerald-600",
    icon: <CheckCircle2 size={14} className="text-emerald-500" />,
      label: "正常",
  };
}

const StorageRequirementCard: React.FC<{ requirement: InventoryStorageRequirement }> = ({ requirement }) => {
  const icon =
    requirement.icon === "temperature" ? <Thermometer size={18} /> : <Droplets size={18} />;

  return (
    <div className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", requirement.colorClassName)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{requirement.label}</p>
        <p className="mt-1 text-lg font-bold text-slate-900">
          {requirement.value}
          <span className="ml-2 text-[11px] font-medium text-emerald-600">{requirement.subValue}</span>
        </p>
      </div>
    </div>
  );
};

const RelatedBatchRow: React.FC<{
  batch: InventoryRelatedBatch;
  formatDate: (date: string) => string;
}> = ({ batch, formatDate }) => {
  const statusMeta = getStatusMeta(batch.health);

  return (
    <tr className="transition-colors hover:bg-surface-container-low/40">
      <td className="px-6 py-5 text-sm font-bold text-on-surface">{batch.id}</td>
      <td className="px-6 py-5 text-right text-sm font-semibold text-on-surface">{batch.quantity}</td>
      <td className="px-6 py-5 text-sm text-on-surface-variant">{formatDate(batch.manufactureDate)}</td>
      <td className="px-6 py-5 text-sm text-on-surface-variant">{formatDate(batch.expireDate)}</td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={cn("h-full rounded-full", statusMeta.progressClassName)} style={{ width: `${batch.progress}%` }} />
          </div>
          <span className={cn("w-10 text-right text-[11px] font-bold", statusMeta.textClassName)}>{batch.progress}%</span>
        </div>
      </td>
      <td className={cn("px-6 py-5 text-right text-sm font-bold", statusMeta.textClassName)}>{batch.remainingDays} 天</td>
    </tr>
  );
};

export const InventoryBatchDetailModal: React.FC<InventoryBatchDetailModalProps> = ({
  open,
  item,
  detail,
  metrics,
  canPrintLabel,
  canSubmitLoss,
  onClose,
  onPrintLabel,
  onOpenLossReport,
  formatDate,
  formatDateTime,
  formatQuantity,
}) => {
  if (!item || !detail || !metrics) {
    return null;
  }

  const statusMeta = getStatusMeta(metrics.health, item.expiryStatus);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 ">
            <motion.section
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="ambient-shadow pointer-events-auto relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="border-b border-surface-container-high p-8 md:p-10 ">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
                        {item.productName}
                      </h2>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em]",
                          statusMeta.badgeClassName,
                        )}
                      >
                        {statusMeta.icon}
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-5 text-xs font-medium text-on-surface-variant">
                      <span className="flex items-center gap-2">
                        <Barcode size={14} />
                        SKU: {detail.sku}
                      </span>
                      <span className="flex items-center gap-2">
                        <Package2 size={14} />
                        分类: {item.category}
                      </span>
                      <span className="flex items-center gap-2">
                        <Layers size={14} />
                        库位: {item.location}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-8 top-8 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:text-primary"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-10 overflow-y-auto p-8 md:p-10">
                <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-bold text-on-surface md:text-[28px]">
                          距离到期还有 <span className={cn("font-black", statusMeta.textClassName)}>{metrics.remainingDays}</span> 天
                        </h3>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em]",
                            statusMeta.badgeClassName,
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                          批次: {detail.primaryBatchId}
                        </span>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">当前库存</span>
                      <div className="mt-2 font-headline text-4xl font-black text-primary">{formatQuantity(item.quantity)}</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-on-surface">生命周期进度: {metrics.percent}%</span>
                      <span className="text-on-surface-variant">到期日期: {formatDate(item.expireDate)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metrics.percent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={cn("h-full rounded-full", statusMeta.progressClassName)}
                      />
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <span className="font-semibold text-on-surface-variant">详细到期时间：</span>
                    <span className="font-bold text-on-surface">{formatDateTime(item.expireDate)}</span>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">总库存</span>
                      <Package2 size={18} className="text-primary" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline text-3xl font-extrabold text-on-surface">{detail.currentStock}</span>
                      <span className="text-xs text-on-surface-variant">单位</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">平均损耗率</span>
                      <BarChart3 size={18} className="text-emerald-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline text-3xl font-extrabold text-on-surface">{detail.averageLossRate}</span>
                      <span className="text-xs text-on-surface-variant">%</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">批次数量</span>
                      <Timer size={18} className="text-amber-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline text-3xl font-extrabold text-on-surface">{detail.batchCount}</span>
                      <span className="text-xs text-on-surface-variant">批次</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-on-surface-variant">
                    <Thermometer size={14} />
                    存储要求
                  </h3>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {detail.storageRequirements.map((requirement) => (
                      <StorageRequirementCard key={requirement.label} requirement={requirement} />
                    ))}
                  </div>
                </section>

                <section className="space-y-5">
                  <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-on-surface-variant">
                    <Layers size={14} />
                    其他批次
                  </h3>
                  <div className="overflow-hidden rounded-3xl border border-surface-container bg-surface-container-lowest">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-container-low text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                          <th className="px-6 py-4">批次 ID</th>
                          <th className="px-6 py-4 text-right">数量</th>
                          <th className="px-6 py-4">生产日期</th>
                          <th className="px-6 py-4">到期日期</th>
                          <th className="px-6 py-4">到期进度</th>
                          <th className="px-6 py-4 text-right">剩余天数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        {detail.relatedBatches.map((batch) => (
                          <RelatedBatchRow key={batch.id} batch={batch} formatDate={formatDate} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="flex flex-col items-stretch justify-end gap-3 border-t border-surface-container-high bg-white/80 p-8 backdrop-blur-sm sm:flex-row">
                {canPrintLabel ? (
                  <button
                    type="button"
                    onClick={onPrintLabel}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg"
                  >
                    <Printer size={14} />
                    打印标签
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-container px-6 py-3 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <ArrowRightLeft size={14} />
                  调拨
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-container px-6 py-3 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Layers size={14} />
                  调整库存
                </button>
                <button
                  type="button"
                  onClick={onOpenLossReport}
                  disabled={!canSubmitLoss}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300 px-6 py-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  {canSubmitLoss ? "报损" : "无报损权限"}
                </button>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
