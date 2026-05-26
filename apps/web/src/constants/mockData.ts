import type { Category, TrendDataPoint, UrgentItem } from "../types/inventory";

export const TREND_DATA: TrendDataPoint[] = [
  { date: "2026-05-24", name: "5/24", value: 40, quantity: 420, type: "normal" },
  { date: "2026-05-27", name: "5/27", value: 55, quantity: 580, type: "normal" },
  { date: "2026-05-30", name: "5/30", value: 35, quantity: 360, type: "normal" },
  { date: "2026-06-03", name: "6/3", value: 75, quantity: 730, type: "normal" },
  { date: "2026-06-06", name: "6/6", value: 85, quantity: 810, type: "normal" },
  { date: "2026-06-09", name: "6/9", value: 60, quantity: 540, type: "warning" },
  { date: "2026-06-13", name: "6/13", value: 95, quantity: 900, type: "critical" },
  { date: "2026-06-16", name: "6/16", value: 65, quantity: 610, type: "normal" },
  { date: "2026-06-20", name: "6/20", value: 45, quantity: 430, type: "normal" },
  { date: "2026-06-23", name: "6/23", value: 30, quantity: 280, type: "normal" },
];

export const CATEGORIES: Category[] = [
  { name: "肉类", percentage: 35, color: "bg-primary" },
  { name: "乳制品", percentage: 22, color: "bg-primary/80" },
  { name: "烘焙", percentage: 18, color: "bg-primary/60" },
  { name: "蔬菜", percentage: 15, color: "bg-primary/40" },
  { name: "其他", percentage: 10, color: "bg-primary/20" },
];

export const URGENT_ITEMS: UrgentItem[] = [
  { id: "1", name: "澳洲安格斯牛肉 300g", batchId: "#BAT-20260512-A", location: "冷库 A-04", stock: 42, daysLeft: 1, status: "critical", initial: "M" },
  { id: "2", name: "全脂巴氏杀菌奶 1L", batchId: "#BAT-20260510-B", location: "冷库 B-12", stock: 156, daysLeft: 3, status: "warning", initial: "D" },
  { id: "3", name: "法式牛角包 6件装", batchId: "#BAT-20260509-X", location: "常温 D-01", stock: 85, daysLeft: 4, status: "warning", initial: "B" },
  { id: "4", name: "冷藏橙汁 500ml", batchId: "#BAT-20260508-C", location: "冷库 B-05", stock: 210, daysLeft: 7, status: "normal", initial: "S" },
  { id: "5", name: "有机小菠菜 200g", batchId: "#BAT-20260507-P", location: "冷库 C-02", stock: 340, daysLeft: 8, status: "normal", initial: "V" },
];
