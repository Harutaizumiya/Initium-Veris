import React from "react";
import type { Category, TrendDataPoint } from "../../types/inventory";
import { useSidebarAnimating } from "../layout/LayoutContext";
import { DistributionChart } from "./DistributionChart";
import { TrendChart } from "./TrendChart";

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

export const ChartGrid: React.FC<ChartGridProps> = ({ trendData, categories }) => {
  const isSidebarAnimating = useSidebarAnimating();
  const chartReady = useChartReady();
  const showSkeleton = isSidebarAnimating || !chartReady;

  return (
    <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="ambient-shadow min-w-0 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8 lg:col-span-2">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h4 className="font-headline text-lg font-bold text-on-surface">批次到期趋势（未来30天）</h4>
            <p className="mt-1 text-xs text-on-surface-variant">基于当前批次效期预测未来的处理压力。</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">按天</button>
            <button className="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-bold text-on-surface-variant">
              按周
            </button>
          </div>
        </div>

        {showSkeleton ? <ChartSkeleton /> : <TrendChart data={trendData} />}
      </div>

      <div className="ambient-shadow min-w-0 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8">
        <h4 className="mb-8 font-headline text-lg font-bold text-on-surface">品类在库分布</h4>
        {showSkeleton ? <ChartSkeleton compact /> : <DistributionChart categories={categories} />}
      </div>
    </div>
  );
};
