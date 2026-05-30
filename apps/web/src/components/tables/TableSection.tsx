import React, { memo } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AlertBatchViewModel } from "../pages/ShelfLifeAlertModal";

interface TableSectionProps {
  items: AlertBatchViewModel[];
  lastUpdatedAt: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export const TableSection = memo(function TableSection({
  items,
  lastUpdatedAt,
  isRefreshing = false,
  onRefresh,
}: TableSectionProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleItems = showAll ? items : items.slice(0, 5);

  return (
  <section className="bg-surface-container-lowest rounded-3xl ambient-shadow border border-surface-container/10 overflow-hidden">
    <div className="p-8 border-b border-surface-container-high flex justify-between items-center">
      <div>
        <h4 className="text-lg font-bold text-on-surface font-headline">
          {showAll ? "临期批次预警（完整列表）" : "临期批次预警（Top 5）"}
        </h4>
        <p className="text-xs text-on-surface-variant mt-1">
          按剩余效期排序的高优先级批次，共 {items.length} 条
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
              商品 / 批次
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              厂商
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">
              数量
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              生产日期
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              到期日期
            </th>
            <th className="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              剩余天数
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-low">
          {visibleItems.map((item) => {
            const { batch, alertStatus, statusBadge } = item;

            return (
              <tr key={batch.id} className="hover:bg-surface-container-low/30 transition-colors group">
                <td className="px-8 py-5">
                  <div className="font-bold text-sm text-on-surface">{batch.product.product_name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-mono text-on-surface-variant">#{batch.batch_code}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        statusBadge.className,
                      )}
                    >
                      {statusBadge.icon}
                      {statusBadge.label}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-5 text-sm text-on-surface-variant">
                  {batch.product.manufacturer}
                </td>
                <td className="px-8 py-5 text-sm font-bold text-on-surface text-center">
                  {item.formattedQuantity}
                </td>
                <td className="px-8 py-5 text-sm text-on-surface-variant">
                  {item.formattedManufactureDate}
                </td>
                <td className="px-8 py-5 text-sm text-on-surface-variant">
                  {item.formattedExpireDate}
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        alertStatus === "expired" ? "bg-red-600" : "bg-amber-500",
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-bold",
                        alertStatus === "expired"
                          ? "text-red-600"
                          : alertStatus === "critical"
                            ? "text-amber-700"
                            : "text-amber-600",
                      )}
                    >
                      {batch.days_until_expiry !== null && batch.days_until_expiry !== undefined
                        ? `${batch.days_until_expiry} 天`
                        : "-"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <div className="p-6 bg-surface-container-low/30 text-center border-t border-surface-container-high">
      <button
        type="button"
        onClick={() => setShowAll((current) => !current)}
        disabled={items.length === 0}
        className="text-sm font-bold text-primary flex items-center justify-center gap-2 mx-auto hover:gap-3 transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showAll ? "收起预警列表" : "查看完整预警列表"}
        <ArrowRight size={16} className={showAll ? "-rotate-90 transition-transform" : "transition-transform"} />
      </button>
    </div>
  </section>
  );
});
