// 仪表盘主页面
// 包含所有仪表板功能组件

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { getDashboardData, getDashboardSnapshot } from "../../api/dashboard";
import { formatErrorMessage, listBatches } from "../../api";
import { queryKeys } from "../../api/queryKeys";
import { PageHeader } from "../dashboard/PageHeader";
import { StatCardGrid } from "../dashboard/StatCardGrid";
import { ChartGrid } from "../charts/ChartGrid";
import { TableSection } from "../tables/TableSection";
import { FloatingActionButtons } from "../actions/FloatingActionButtons";
import { buildShelfLifeAlertBatches, ShelfLifeAlertModal } from "./ShelfLifeAlertModal";

const DASHBOARD_ERROR_MESSAGE_OPTIONS = {
  fallback: "总览数据请求失败，请稍后重试。",
  apiClientMessages: {
    conflict: "当前演示数据暂时无法生成总览聚合数据。",
  },
  apiClientFallback: (error: Error) => `总览数据请求失败：${error.message}`,
};

function formatUpdatedAt(timestamp: number) {
  if (!timestamp) {
    return "--:--";
  }

  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DashboardPage: React.FC = () => {
  const [isShelfLifeAlertOpen, setIsShelfLifeAlertOpen] = useState(false);
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.data(),
    queryFn: getDashboardData,
  });
  const shelfLifeAlertQuery = useQuery({
    queryKey: ["shelf-life-alerts", "dashboard-card"],
    queryFn: async () => {
      const data = await listBatches({ page: 1, size: 100 });
      return buildShelfLifeAlertBatches(data.items);
    },
  });
  const dashboardData = dashboardQuery.data ?? getDashboardSnapshot();
  const shelfLifeAlertItems = shelfLifeAlertQuery.data ?? [];
  const shelfLifeAlertUpdatedAt = formatUpdatedAt(shelfLifeAlertQuery.dataUpdatedAt);

  return (
    <>
      <PageHeader />
      {dashboardQuery.isLoading ? (
        <div className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          <LoaderCircle size={16} className="animate-spin" />
          正在同步前端模拟总览数据
        </div>
      ) : null}
      {dashboardQuery.error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
          {formatErrorMessage(dashboardQuery.error, DASHBOARD_ERROR_MESSAGE_OPTIONS)}
        </div>
      ) : null}
      <StatCardGrid stats={dashboardData.stats} />
      <ChartGrid trendData={dashboardData.trendData} categories={dashboardData.categories} />
      <TableSection
        items={shelfLifeAlertItems}
        lastUpdatedAt={shelfLifeAlertUpdatedAt}
        isRefreshing={shelfLifeAlertQuery.isFetching}
        onRefresh={() => void shelfLifeAlertQuery.refetch()}
      />
      <FloatingActionButtons onOpenShelfLifeAlert={() => setIsShelfLifeAlertOpen(true)} />
      <ShelfLifeAlertModal open={isShelfLifeAlertOpen} onClose={() => setIsShelfLifeAlertOpen(false)} />
    </>
  );
};
