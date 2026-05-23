import type { ReactNode } from "react";

export interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendType?: "up" | "down" | "neutral" | "critical";
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}

export type DashboardStatIcon = "package" | "timer" | "alert" | "shield";

export interface DashboardStat {
  id: string;
  title: string;
  value: string;
  trend?: string;
  trendType?: StatCardProps["trendType"];
  icon: DashboardStatIcon;
  iconBg: string;
  iconColor: string;
}

export interface UrgentItem {
  id: string;
  name: string;
  batchId: string;
  location: string;
  stock: number;
  daysLeft: number;
  status: "critical" | "warning" | "normal";
  initial: string;
}

export interface Category {
  name: string;
  percentage: number;
  color: string;
}

export interface TrendDataPoint {
  name: string;
  value: number;
  type: "normal" | "warning" | "critical";
}
