import React from "react";
import type { Category, TrendDataPoint } from "../../types/inventory";
import { useSidebarAnimating } from "../layout/LayoutContext";
import { DistributionChart } from "./DistributionChart";
import { TrendChart, type TrendChartPoint } from "./TrendChart";

function useChartReady() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setReady(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  return ready;
}

function ChartSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-5" : "h-64 w-full"}>
      {compact ? (
        <>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 rounded-full bg-slate-200/80" />
                <div className="h-3 w-8 rounded-full bg-slate-200/80" />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                <div className="h-full rounded-full bg-slate-300/80" style={{ width: `${70 - index * 12}%` }} />
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="flex h-full items-end gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-2xl bg-slate-200/80"
              style={{ height: `${45 + ((index * 11) % 35)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChartGridProps {
  trendData: TrendDataPoint[];
  categories: Category[];
}

type TrendView = "day" | "week";

function formatDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatBatchCount(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatQuantity(value: number) {
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: 0,
  });
}

function buildDailyChartData(trendData: TrendDataPoint[]): TrendChartPoint[] {
  return trendData.map((point) => ({
    label: point.name,
    tooltipLabel: point.date,
    warningCount: point.type === "warning" ? point.value : 0,
    criticalCount: point.type === "critical" ? point.value : 0,
    totalCount: point.value,
    quantity: point.quantity,
  }));
}

function buildWeeklyChartData(trendData: TrendDataPoint[]): TrendChartPoint[] {
  const groups: TrendChartPoint[] = [];

  for (let index = 0; index < trendData.length; index += 7) {
    const slice = trendData.slice(index, index + 7);
    if (slice.length === 0) {
      continue;
    }

    const start = slice[0];
    const end = slice[slice.length - 1];
    const warningCount = slice.reduce((sum, point) => sum + (point.type === "warning" ? point.value : 0), 0);
    const criticalCount = slice.reduce((sum, point) => sum + (point.type === "critical" ? point.value : 0), 0);
    const totalCount = slice.reduce((sum, point) => sum + point.value, 0);
    const quantity = slice.reduce((sum, point) => sum + point.quantity, 0);

    groups.push({
      label: `${formatDisplayDate(start.date)}-${formatDisplayDate(end.date)}`,
      tooltipLabel: `${start.date} 至 ${end.date}`,
      warningCount,
      criticalCount,
      totalCount,
      quantity,
    });
  }

  return groups;
}

export const ChartGrid: React.FC<ChartGridProps> = ({ trendData, categories }) => {
  const isSidebarAnimating = useSidebarAnimating();
  const chartReady = useChartReady();
  const showSkeleton = isSidebarAnimating || !chartReady;
  const [trendView, setTrendView] = React.useState<TrendView>("day");
  const chartData = React.useMemo(
    () => (trendView === "week" ? buildWeeklyChartData(trendData) : buildDailyChartData(trendData)),
    [trendData, trendView],
  );
  const totalRiskBatches = React.useMemo(() => chartData.reduce((sum, point) => sum + point.totalCount, 0), [chartData]);
  const criticalRiskBatches = React.useMemo(
    () => chartData.reduce((sum, point) => sum + point.criticalCount, 0),
    [chartData],
  );
  const warningRiskBatches = React.useMemo(
    () => chartData.reduce((sum, point) => sum + point.warningCount, 0),
    [chartData],
  );
  const totalRiskQuantity = React.useMemo(() => chartData.reduce((sum, point) => sum + point.quantity, 0), [chartData]);
  const peakPoint = React.useMemo(
    () => chartData.reduce<TrendChartPoint | null>((peak, point) => (!peak || point.totalCount > peak.totalCount ? point : peak), null),
    [chartData],
  );
  const hasTrendData = totalRiskBatches > 0;

  return (
    <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="ambient-shadow min-w-0 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8 lg:col-span-2">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div>
              <h4 className="font-headline text-lg font-bold text-on-surface">批次到期趋势（未来30天）</h4>
              <p className="mt-1 text-xs text-on-surface-variant">基于当前批次效期预测未来的处理压力。</p>
            </div>
            {!showSkeleton ? (
              <div className="flex flex-wrap gap-2">
                <div className="rounded-2xl bg-surface-container-low px-4 py-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">总风险批次</div>
                  <div className="mt-1 text-sm font-bold text-on-surface">{formatBatchCount(totalRiskBatches)}</div>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">观察区间</div>
                  <div className="mt-1 text-sm font-bold text-amber-800">{formatBatchCount(warningRiskBatches)}</div>
                </div>
                <div className="rounded-2xl bg-red-50 px-4 py-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-700">高优先处理</div>
                  <div className="mt-1 text-sm font-bold text-red-800">{formatBatchCount(criticalRiskBatches)}</div>
                </div>
                <div className="rounded-2xl bg-surface-container-low px-4 py-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">压力峰值</div>
                  <div className="mt-1 text-sm font-bold text-on-surface">
                    {peakPoint ? `${peakPoint.label} · ${formatBatchCount(peakPoint.totalCount)}` : "--"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            {[
              { id: "day" as const, label: "按天" },
              { id: "week" as const, label: "按周" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTrendView(option.id)}
                className={
                  trendView === option.id
                    ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
                    : "rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-bold text-on-surface-variant"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {showSkeleton ? (
          <ChartSkeleton />
        ) : hasTrendData ? (
          <>
            <TrendChart data={chartData} />
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                8 至 30 天内到期，建议排入观察
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                7 天内到期，建议优先处理
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-surface-container bg-surface px-3 py-1 text-on-surface-variant">
                风险数量 {formatBatchCount(totalRiskBatches)} · 预计影响在库量 {formatQuantity(totalRiskQuantity)}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-surface-container bg-surface text-center">
            <div className="text-lg font-bold text-on-surface">未来 30 天暂无到期压力</div>
            <p className="mt-2 text-sm text-on-surface-variant">当前没有临近到期批次，库存节奏相对平稳。</p>
          </div>
        )}
      </div>

      <div className="ambient-shadow min-w-0 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8">
        <h4 className="mb-8 font-headline text-lg font-bold text-on-surface">品类在库分布</h4>
        {showSkeleton ? <ChartSkeleton compact /> : <DistributionChart categories={categories} />}
      </div>
    </div>
  );
};
