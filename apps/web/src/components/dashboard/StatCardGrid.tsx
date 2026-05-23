import React, { memo } from "react";
import { AlertTriangle, Clock3, Package, ShieldCheck } from "lucide-react";
import type { DashboardStat, DashboardStatIcon } from "../../types/inventory";
import { StatCard } from "./StatCard";

const STAT_ICONS: Record<DashboardStatIcon, React.ReactNode> = {
  package: <Package size={24} />,
  timer: <Clock3 size={24} className="text-amber-600" />,
  alert: <AlertTriangle size={24} className="text-red-600" />,
  shield: <ShieldCheck size={24} />,
};

interface StatCardGridProps {
  stats: DashboardStat[];
}

export const StatCardGrid = memo(function StatCardGrid({ stats }: StatCardGridProps) {
  return (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {stats.map((stat) => (
      <StatCard
        key={stat.id}
        title={stat.title}
        value={stat.value}
        trend={stat.trend}
        trendType={stat.trendType}
        icon={STAT_ICONS[stat.icon]}
        iconBg={stat.iconBg}
        iconColor={stat.iconColor}
      />
    ))}
  </div>
  );
});
