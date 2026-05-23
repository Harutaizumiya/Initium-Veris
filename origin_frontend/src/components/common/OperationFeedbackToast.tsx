import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OperationAlert, type OperationAlertType } from "./OperationAlert";

export interface OperationFeedbackState {
  type: OperationAlertType;
  title: string;
  description?: string;
  debugDetail?: string | null;
}

interface OperationFeedbackToastProps {
  open: boolean;
  feedback: OperationFeedbackState | null;
  onClose: () => void;
  duration?: number;
}

export function getErrorDebugDetail(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export const OperationFeedbackToast: React.FC<OperationFeedbackToastProps> = ({
  open,
  feedback,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, onClose, open]);

  return (
    <AnimatePresence>
      {open && feedback ? (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="pointer-events-none fixed left-1/2 top-6 z-[110] w-full max-w-xl -translate-x-1/2 px-4"
        >
          <div className="pointer-events-auto space-y-3">
            <OperationAlert
              type={feedback.type}
              title={feedback.title}
              description={feedback.description}
              showIcon
              className="ambient-shadow"
            />
            {import.meta.env.DEV && feedback.debugDetail ? (
              <div className="rounded-3xl border border-surface-container/80 bg-surface-container-lowest/95 p-4 text-xs leading-6 text-on-surface-variant shadow-sm backdrop-blur">
                <div className="mb-2 font-bold text-on-surface">调试详情</div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all">{feedback.debugDetail}</pre>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
