// 仪表盘主页面
// 包含所有仪表板功能组件

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { getDashboardData, getDashboardSnapshot } from "../../api/dashboard";
import { queryKeys } from "../../api/queryKeys";
import { ApiClientError } from "../../api/types";
import { PageHeader } from "../dashboard/PageHeader";
import { StatCardGrid } from "../dashboard/StatCardGrid";
import { ChartGrid } from "../charts/ChartGrid";
import { TableSection } from "../tables/TableSection";
import { FloatingActionButtons } from "../actions/FloatingActionButtons";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    switch (error.message) {
      case "conflict":
        return "后端暂时无法生成总览聚合数据。";
      default:
        return `总览数据请求失败：${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "总览数据请求失败，请稍后重试。";
}

export const DashboardPage: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: getDashboardData,
  });
  const dashboardData = dashboardQuery.data ?? getDashboardSnapshot();

  return (
    <>
      <PageHeader />
      {dashboardQuery.isLoading ? (
        <div className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          <LoaderCircle size={16} className="animate-spin" />
          正在从 `/api/dashboard/overview` 同步总览数据
        </div>
      ) : null}
      {dashboardQuery.error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
          {getErrorMessage(dashboardQuery.error)}
        </div>
      ) : null}
      <StatCardGrid stats={dashboardData.stats} />
      <ChartGrid trendData={dashboardData.trendData} categories={dashboardData.categories} />
      <TableSection items={dashboardData.urgentItems} lastUpdatedAt={dashboardData.lastUpdatedAt} />
      <FloatingActionButtons />
    </>
  );
};
