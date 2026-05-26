import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, LogOut, TriangleAlert, UserRound } from "lucide-react";
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loggingOut) {
        setConfirmOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen, loggingOut]);

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setConfirmOpen(false);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
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
          onClick={() => setConfirmOpen(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-surface-container bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut size={15} />
        </button>
      </div>
      <AnimatePresence>
        {confirmOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
              onClick={loggingOut ? undefined : () => setConfirmOpen(false)}
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.section
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="ambient-shadow pointer-events-auto w-full max-w-md rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest p-8"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <TriangleAlert size={24} />
                </div>
                <h3 id="logout-confirm-title" className="text-center font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                  确认退出登录
                </h3>
                <p className="mt-3 text-center text-sm leading-6 text-on-surface-variant">
                  当前会话将被清除，并返回登录状态。请确认是否继续退出。
                </p>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={loggingOut}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogoutConfirm()}
                    disabled={loggingOut}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-300 px-5 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loggingOut ? <LoaderCircle size={16} className="animate-spin" /> : null}
                    确认退出
                  </button>
                </div>
              </motion.section>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
};
