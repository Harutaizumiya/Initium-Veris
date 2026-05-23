import React from "react";
import { LogOut, UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

interface ProfileWidgetProps {
  collapsed: boolean;
}

const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function getInitials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export const ProfileWidget: React.FC<ProfileWidgetProps> = ({ collapsed }) => {
  const { logout, user } = useAuth();
  const displayName = user?.displayName || user?.username || "未登录";
  const role = user?.roleLabel || "普通用户";

  return (
    <div
      className={cn(
        "mt-4 flex border-t border-surface-container px-4 pt-6",
        collapsed ? "flex-col items-center justify-center gap-2" : "items-center gap-3",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
        {user ? getInitials(displayName) : <UserRound size={15} />}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden transition-[max-width,opacity] duration-500",
          collapsed ? "max-w-0 opacity-0" : "max-w-[130px] opacity-100",
        )}
        style={{ transitionTimingFunction: SIDEBAR_EASING }}
      >
        <p className="truncate text-xs font-bold text-on-surface">{displayName}</p>
        <p className="truncate text-[10px] text-on-surface-variant">{role}</p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-surface-container bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
        aria-label="退出登录"
        title="退出登录"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
};
