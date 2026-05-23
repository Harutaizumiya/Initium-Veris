import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

interface TrendBadgeProps {
  trend?: string;
  trendType?: "up" | "down" | "neutral" | "critical";
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ trend, trendType }) => {
  if (!trend) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold",
        trendType === "up"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : trendType === "down"
            ? "border-red-200 bg-red-50 text-error"
            : trendType === "critical"
              ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-surface-container-high bg-surface-container-low text-amber-700",
      )}
    >
      {trendType === "up" ? (
        <TrendingUp size={14} />
      ) : trendType === "down" ? (
        <TrendingDown size={14} />
      ) : (
        <AlertTriangle size={14} />
      )}
      {trend}
    </span>
  );
};
