import React, { memo } from "react";
import { cn } from "../../lib/utils";
import type { UrgentItem } from "../../types/inventory";
import { LocationBadge } from "../common/LocationBadge";
import { StatusBadge } from "../common/StatusBadge";

interface UrgentTableRowProps {
  item: UrgentItem;
}

export const UrgentTableRow = memo(function UrgentTableRow({ item }: UrgentTableRowProps) {
  return (
  <tr className="hover:bg-surface-container-low/30 transition-colors group">
    <td className="px-8 py-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded flex items-center justify-center font-bold text-xs",
            item.status === "critical"
              ? "bg-amber-100 text-amber-700"
              : item.status === "warning"
                ? "bg-amber-500/10 text-amber-600"
                : "bg-primary/10 text-primary",
          )}
        >
          {item.initial}
        </div>
        <span className="font-bold text-sm text-on-surface">{item.name}</span>
      </div>
    </td>
    <td className="px-8 py-5 text-sm font-mono text-on-surface-variant">
      {item.batchId}
    </td>
    <td className="px-8 py-5">
      <LocationBadge location={item.location} />
    </td>
    <td className="px-8 py-5 text-sm font-bold text-on-surface text-center">
      {item.stock}
    </td>
    <td className="px-8 py-5">
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        <span
          className={cn(
            "text-sm font-bold",
            item.status === "critical"
              ? "text-amber-700"
              : item.status === "warning"
                ? "text-amber-600"
                : "text-on-surface",
          )}
        >
          {item.daysLeft} 天
        </span>
      </div>
    </td>
    <td className="px-8 py-5 text-right">
      <button className="text-primary text-xs font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === "critical"
          ? "立即处理"
          : item.status === "warning"
            ? "折扣促销"
            : "查看详情"}
      </button>
    </td>
  </tr>
  );
});
