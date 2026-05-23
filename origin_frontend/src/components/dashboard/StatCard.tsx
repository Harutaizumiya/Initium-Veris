import React, { memo } from "react";
import { motion } from "motion/react";
import type { StatCardProps } from "../../types/inventory";
import { cn } from "../../lib/utils";
import { TrendBadge } from "../common/TrendBadge";

export const StatCard = memo(function StatCard({
  title,
  value,
  trend,
  trendType,
  icon: Icon,
  iconBg,
  iconColor,
}: StatCardProps) {
  return (
  <motion.div
    whileHover={{ y: -4 }}
    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    className="group rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-7 ambient-shadow"
  >
    <div className="mb-5 flex items-start justify-between gap-4">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[20px] transition-transform duration-300 group-hover:scale-[1.02]",
          iconBg,
          iconColor,
        )}
      >
        {Icon}
      </div>
      <TrendBadge trend={trend} trendType={trendType} />
    </div>
    <p className="text-sm font-semibold text-on-surface-variant">{title}</p>
    <h3 className="mt-2 font-headline text-4xl font-black tracking-tight text-on-surface">
      {value}
    </h3>
  </motion.div>
  );
});
