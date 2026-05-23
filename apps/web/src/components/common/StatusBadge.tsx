import React from "react";
import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "critical" | "warning" | "normal";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={cn(
      "w-2 h-2 rounded-full",
      status === "critical"
        ? "bg-amber-600"
        : status === "warning"
          ? "bg-amber-500"
          : "bg-primary",
    )}
  />
);
