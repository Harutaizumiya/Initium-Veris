import React, { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendChartPoint {
  label: string;
  tooltipLabel: string;
  warningCount: number;
  criticalCount: number;
  totalCount: number;
  quantity: number;
}

interface TrendChartProps {
  data: TrendChartPoint[];
}

function formatQuantity(value: number) {
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: 0,
  });
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: TrendChartPoint;
  }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="min-w-[220px] rounded-2xl border border-surface-container/80 bg-surface-container-lowest px-4 py-3 shadow-xl">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{point.tooltipLabel}</div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-on-surface-variant">总风险批次</span>
          <span className="font-bold text-on-surface">{point.totalCount.toLocaleString("zh-CN")}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-amber-700">观察区间</span>
          <span className="font-bold text-amber-800">{point.warningCount.toLocaleString("zh-CN")}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-red-700">高优先处理</span>
          <span className="font-bold text-red-800">{point.criticalCount.toLocaleString("zh-CN")}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-surface-container pt-2">
          <span className="text-on-surface-variant">预计影响在库量</span>
          <span className="font-bold text-on-surface">{formatQuantity(point.quantity)}</span>
        </div>
      </div>
    </div>
  );
}

export const TrendChart = memo(function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="h-72 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E8E8" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={18}
            tick={{ fontSize: 10, fill: "#414755" }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            width={28}
            tick={{ fontSize: 10, fill: "#414755" }}
          />
          <Tooltip cursor={{ fill: "rgba(0, 87, 194, 0.05)" }} content={<TrendTooltip />} />
          <Bar dataKey="warningCount" stackId="risk" radius={[6, 6, 0, 0]} barSize={24} fill="#FBBF24" />
          <Bar dataKey="criticalCount" stackId="risk" radius={[6, 6, 0, 0]} barSize={24} fill="#E35D5D" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
