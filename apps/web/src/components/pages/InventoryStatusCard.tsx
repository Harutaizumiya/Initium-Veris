import React, { memo, useCallback } from "react";
import { cn } from "../../lib/utils";
import type {
  InventoryHealthMeta,
  InventoryRecord,
  ShelfLifeMetrics,
} from "./InventoryStatus.types";

interface InventoryStatusCardProps {
  item: InventoryRecord;
  metrics: ShelfLifeMetrics;
  meta: InventoryHealthMeta;
  formattedQuantity: string;
  formattedManufactureDate: string;
  formattedExpireDate: string;
  formattedReceivedDate: string;
  onOpenDetail: (item: InventoryRecord) => void;
}

function getOperationsHint(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) {
    return "已过期";
  }
  if (daysUntilExpiry <= 3) {
    return "强提醒";
  }
  if (daysUntilExpiry <= 7) {
    return "提醒";
  }
  if (daysUntilExpiry <= 30) {
    return "可关注";
  }
  return "正常跟进";
}

export const InventoryStatusCard = memo(function InventoryStatusCard({
  item,
  metrics,
  meta,
  formattedQuantity,
  formattedManufactureDate,
  formattedExpireDate,
  formattedReceivedDate,
  onOpenDetail,
}: InventoryStatusCardProps) {
  const isExpired = item.expiryStatus === "expired";
  const isCritical = metrics.health === "critical";
  const openDetail = useCallback(() => onOpenDetail(item), [item, onOpenDetail]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = useCallback((event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail();
    }
  }, [openDetail]);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex h-full min-h-[312px] min-w-0 w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white px-4 pb-4 pt-4 transition-all hover:-translate-y-1 cursor-pointer sm:min-h-[332px] sm:px-5 sm:pb-5 sm:pt-5",
      )}
    >
      {isCritical && (
        <div
          className={cn(
            "pointer-events-none absolute inset-[-1px] rounded-3xl border-3 animate-pulse",
            isExpired
              ? "border-red-400 shadow-[inset_0_0_10px_rgba(239,68,68,0.2)]"
              : "border-amber-400 shadow-[inset_0_0_10px_rgba(245,158,11,0.18)]",
          )}
          style={{ animationDuration: "2.5s" }}
        />
      )}

      <div
        className={cn("absolute inset-x-0 bottom-0 h-1.5", meta.lineClassName)}
      />

      <div className="mb-2.5 flex items-start justify-between gap-2.5 sm:mb-3 sm:gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
            <span>数量 {formattedQuantity}</span>
            <span className="text-slate-300">|</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] sm:text-[10px]">
              {item.category}
            </span>
          </div>
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-5 text-slate-900 sm:text-[15px]">
            {item.productName}
          </h3>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold sm:text-[9px]",
            meta.tagClassName,
          )}
        >
          {meta.icon}
          {meta.label}
        </span>
      </div>

      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-slate-500 sm:mb-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] sm:text-[10px]">
          {item.manufacturer}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] sm:text-[10px]">
          {item.location}
        </span>
      </div>

      <div className="mb-2.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:mb-3 sm:p-3.5">
        <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500 sm:text-[11px]">
          <span>生命周期进度</span>
          <span className="font-semibold text-slate-700">
            {metrics.percent}%
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className={cn("h-1.5 rounded-full transition-all", meta.progress)}
            style={{ width: `${metrics.percent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <div>
            <div className="text-[9px] text-slate-400 sm:text-[10px]">
              生产日期
            </div>
            <div className="mt-1 text-[11px] font-semibold text-slate-900 sm:text-[12px]">
              {formattedManufactureDate}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400 sm:text-[10px]">
              到期日期
            </div>
            <div className="mt-1 text-[11px] font-semibold text-slate-900 sm:text-[12px]">
              {formattedExpireDate}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-slate-500">
        <div>
          <div className="mb-1 text-[9px] text-slate-400 sm:text-[10px]">
            收货日期
          </div>
          <div className="text-[11px] font-semibold text-slate-900 sm:text-[12px]">
            {formattedReceivedDate}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[9px] text-slate-400 sm:text-[10px]">
            剩余天数
          </div>
          <div className="text-[11px] font-semibold text-slate-900 sm:text-[12px]">
            {metrics.remainingDays} 天 · {getOperationsHint(metrics.remainingDays)}
          </div>
        </div>
      </div>
    </article>
  );
});
