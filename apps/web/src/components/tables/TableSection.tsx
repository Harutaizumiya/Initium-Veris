import React, { memo } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { UrgentItem } from "../../types/inventory";
import { UrgentTableRow } from "./UrgentTableRow";

interface TableSectionProps {
  items: UrgentItem[];
  lastUpdatedAt: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onViewAll?: () => void;
}

export const TableSection = memo(function TableSection({
  items,
  lastUpdatedAt,
  isRefreshing = false,
  onRefresh,
  onViewAll,
}: TableSectionProps) {
  return (
  <section className="bg-surface-container-lowest rounded-3xl ambient-shadow border border-surface-container/10 overflow-hidden">
    <div className="p-8 border-b border-surface-container-high flex justify-between items-center">
      <div>
        <h4 className="text-lg font-bold text-on-surface font-headline">
          临期批次预警（Top 5）
        </h4>
        <p className="text-xs text-on-surface-variant mt-1">
          按剩余效期排序的高优先级批次
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-on-surface-variant">
          自动更新于 {lastUpdatedAt}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!onRefresh || isRefreshing}
          className="text-on-surface-variant hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="刷新临期批次预警"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : undefined} />
        </button>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-container-low/50">
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              产品名称
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              批次 ID
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              存储区域
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">
              当前库存
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              剩余效期
            </th>
            <th className="px-8 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-low">
          {items.map((item) => (
            <UrgentTableRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>

    <div className="p-6 bg-surface-container-low/30 text-center border-t border-surface-container-high">
      <button
        type="button"
        onClick={onViewAll}
        disabled={!onViewAll}
        className="text-sm font-bold text-primary flex items-center justify-center gap-2 mx-auto hover:gap-3 transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        查看完整预警列表
        <ArrowRight size={16} />
      </button>
    </div>
  </section>
  );
});
