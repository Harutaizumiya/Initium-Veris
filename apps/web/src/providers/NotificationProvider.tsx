import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OperationAlert, type OperationAlertType } from "../components/common/OperationAlert";

export interface NotificationInput {
  title: string;
  description?: string;
  type?: OperationAlertType;
  duration?: number;
  debugDetail?: string | null;
}

interface NotificationEntry extends Required<Pick<NotificationInput, "title" | "type">> {
  id: string;
  description?: string;
  duration: number;
  debugDetail?: string | null;
}

interface NotificationApi {
  clear: () => void;
  dismiss: (id: string) => void;
  error: (input: Omit<NotificationInput, "type">) => string;
  info: (input: Omit<NotificationInput, "type">) => string;
  notify: (input: NotificationInput) => string;
  success: (input: Omit<NotificationInput, "type">) => string;
  warning: (input: Omit<NotificationInput, "type">) => string;
}

const NotificationContext = createContext<NotificationApi | null>(null);

const MAX_VISIBLE_NOTIFICATIONS = 3;

function getDefaultDuration(type: OperationAlertType) {
  if (type === "warning") {
    return 4500;
  }

  if (type === "error") {
    return 5000;
  }

  return 3000;
}

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: NotificationEntry;
  onDismiss: (id: string) => void;
}) {
  const [isInteracting, setIsInteracting] = useState(false);

  React.useEffect(() => {
    if (isInteracting) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismiss(notification.id);
    }, notification.duration);

    return () => window.clearTimeout(timer);
  }, [isInteracting, notification.duration, notification.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="pointer-events-auto space-y-3"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsInteracting(false);
        }
      }}
    >
      <OperationAlert
        type={notification.type}
        title={notification.title}
        description={notification.description}
        showIcon
        closable
        onClose={() => onDismiss(notification.id)}
        className="ambient-shadow"
      />
      {import.meta.env.DEV && notification.debugDetail ? (
        <div className="rounded-3xl border border-surface-container/80 bg-surface-container-lowest/95 p-4 text-xs leading-6 text-on-surface-variant shadow-sm backdrop-blur">
          <div className="mb-2 font-bold text-on-surface">调试详情</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">{notification.debugDetail}</pre>
        </div>
      ) : null}
    </motion.div>
  );
}

function NotificationViewport({
  notifications,
  onDismiss,
}: {
  notifications: NotificationEntry[];
  onDismiss: (id: string) => void;
}) {
  const visibleNotifications = notifications.slice(-MAX_VISIBLE_NOTIFICATIONS).reverse();

  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-[110] w-full max-w-xl -translate-x-1/2 px-4">
      <AnimatePresence initial={false}>
        {visibleNotifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((currentNotifications) => currentNotifications.filter((notification) => notification.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const type = input.type ?? "info";

    setNotifications((currentNotifications) => [
      ...currentNotifications,
      {
        id,
        title: input.title,
        description: input.description,
        type,
        duration: input.duration ?? getDefaultDuration(type),
        debugDetail: input.debugDetail,
      },
    ]);

    return id;
  }, []);

  const api = useMemo<NotificationApi>(
    () => ({
      clear,
      dismiss,
      error: (input) => notify({ ...input, type: "error" }),
      info: (input) => notify({ ...input, type: "info" }),
      notify,
      success: (input) => notify({ ...input, type: "success" }),
      warning: (input) => notify({ ...input, type: "warning" }),
    }),
    [clear, dismiss, notify],
  );

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <NotificationViewport notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }

  return context;
}
