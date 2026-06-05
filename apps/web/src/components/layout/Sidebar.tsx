import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { SidebarMenu } from "../navigation/SidebarMenu";
import { ProfileWidget } from "../navigation/ProfileWidget";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => (
  <aside
    style={{ width: collapsed ? 80 : 256, transitionTimingFunction: SIDEBAR_EASING }}
    className="fixed left-0 top-0 z-20 flex h-screen flex-col rounded-r-3xl bg-surface-container-low py-6 shadow-xl transition-[width] duration-500 will-change-[width]"
  >
    <div className="mb-8 px-4 transition-[margin] duration-500" style={{ transitionTimingFunction: SIDEBAR_EASING }}>
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[max-width,opacity] duration-500",
            collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100",
          )}
          style={{ transitionTimingFunction: SIDEBAR_EASING }}
        >
          <h1 className="truncate font-headline text-lg font-bold tracking-tighter text-primary">Veris</h1>
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">Demo</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-surface-container bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
    </div>

    <SidebarMenu collapsed={collapsed} />

    <ProfileWidget collapsed={collapsed} />
  </aside>
);
