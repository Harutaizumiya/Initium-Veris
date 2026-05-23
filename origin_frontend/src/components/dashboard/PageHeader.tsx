import React from "react";
import { Download } from "lucide-react";

export const PageHeader: React.FC = () => (
  <div className="mb-8 flex justify-between items-end">
    <div>
      <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline">
        库存实时总览
      </h2>
      <p className="text-on-surface-variant mt-1">
        监控全局食品库存状态及效期风险
      </p>
    </div>
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
    >
      <Download size={16} />
      导出报表
    </button>
  </div>
);
