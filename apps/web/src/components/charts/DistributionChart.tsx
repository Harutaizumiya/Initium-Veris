import React, { memo, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Category } from "../../types/inventory";

interface DistributionChartProps {
  categories: Category[];
}

export const DistributionChart = memo(function DistributionChart({ categories }: DistributionChartProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > 6;
  const visibleCategories = useMemo(
    () => (expanded || !hasMore ? categories : categories.slice(0, 6)),
    [categories, expanded, hasMore],
  );

  return (
  <div className="space-y-6">
    {visibleCategories.map((cat) => (
      <div key={cat.name} className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">{cat.name}</span>
          <span className="font-bold text-on-surface">{cat.percentage}%</span>
        </div>
        <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cat.percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>
    ))}
    {hasMore ? (
      <div className="mt-8 flex justify-center border-t border-surface-container-high pt-6">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-surface-container-high bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          {expanded ? "收起列表" : `查看完整列表（${categories.length}）`}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    ) : null}
  </div>
  );
});
