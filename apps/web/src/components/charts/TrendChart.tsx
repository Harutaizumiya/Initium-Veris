// 库存到期趋势图表组件
// 使用柱状图显示未来30天库存到期趋势，按日期分组显示

import React, { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TrendDataPoint } from "../../types/inventory";

interface TrendChartProps {
  data: TrendDataPoint[];
}

export const TrendChart = memo(function TrendChart({ data }: TrendChartProps) {
  return (
  <div className="h-64 min-w-0 w-full">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
      >
        {/* 网格线 */}
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f0f0f0"
        />
        {/* X轴 - 日期 */}
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#414755" }}
        />
        {/* Y轴 - 数值 */}
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#414755" }}
        />
        {/* 悬停提示 */}
        <Tooltip
          cursor={{ fill: "rgba(0, 87, 194, 0.05)" }}
          contentStyle={{
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
          }}
        />
        {/* 数据柱状图，根据类型设置不同颜色 */}
        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.type === "critical"
                  ? "#D97706"
                  : entry.type === "warning"
                    ? "#FBBF24"
                    : "#0057C266"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
  );
});
