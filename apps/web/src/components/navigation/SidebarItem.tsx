import React from "react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

interface SidebarItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  to: string;
  collapsed: boolean;
  active?: boolean;
  compact?: boolean;
  trailingIcon?: React.ReactNode;
  onClick?: () => void;
}

const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const ICON_ANCHOR_LEFT = 26;
const LABEL_LEFT = 58;
const SIDEBAR_ANIMATION_DURATION = 0.5;
const COLLAPSED_PILL_WIDTH = 56;
const EXPANDED_PILL_WIDTH = 240;

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  to,
  collapsed,
  active = false,
  compact = false,
  trailingIcon,
  onClick,
}) => {
  const location = useLocation();
  const isActive = active || location.pathname === to;
  const itemHeight = compact ? 40 : 48;
  const iconLeft = compact ? 16 : ICON_ANCHOR_LEFT;
  const labelLeft = compact ? 44 : LABEL_LEFT;

  const content = (
    <div className="relative" style={{ height: `${itemHeight}px` }}>
      <motion.div
        initial={false}
        animate={{
          opacity: isActive ? 1 : 0,
          scale: isActive ? 1 : 0.96,
          backgroundColor: "rgba(255, 255, 255, 1)",
          left: collapsed ? 10 : 0,
          width: collapsed ? COLLAPSED_PILL_WIDTH : compact ? 196 : EXPANDED_PILL_WIDTH,
        }}
        transition={{ duration: SIDEBAR_ANIMATION_DURATION, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute bottom-0 top-0 rounded-full shadow-sm"
      />

      <motion.div
        initial={false}
        animate={{
          opacity: isActive ? 1 : 0,
          width: isActive ? "3px" : "0px",
          left: collapsed ? 10 : 0,
        }}
        transition={{ duration: SIDEBAR_ANIMATION_DURATION, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-primary"
      />

      <div className="relative h-full">
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${iconLeft}px` }}>
          <motion.div
            initial={false}
            animate={{
              scale: isActive ? 1.08 : 1,
              x: isActive ? 2 : 0,
              color: isActive ? "var(--color-primary)" : "var(--color-on-surface-variant)",
            }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-5 w-5 items-center justify-center"
          >
            <Icon
              size={20}
              className={cn(
                "transition-colors duration-300",
                isActive ? "text-primary" : "text-on-surface-variant group-hover:text-primary",
              )}
            />
          </motion.div>
        </div>

        <div className="absolute right-4 top-1/2 min-w-0 -translate-y-1/2 overflow-hidden" style={{ left: `${labelLeft}px` }}>
          <motion.div
            initial={false}
            animate={{
              opacity: collapsed ? 0 : 1,
              maxWidth: collapsed ? 0 : 140,
            }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden whitespace-nowrap"
          >
            <span
              className={cn(
                "font-headline text-sm tracking-tight transition-colors duration-300 group-hover:text-primary",
                isActive ? "text-primary" : "text-on-surface-variant",
              )}
            >
              {label}
            </span>
          </motion.div>
        </div>
        {!collapsed && trailingIcon ? <div className="absolute right-6 top-1/2 -translate-y-1/2">{trailingIcon}</div> : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group relative block w-full px-2 text-left" title={collapsed ? label : undefined}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className="group relative block px-2" title={collapsed ? label : undefined}>
      {content}
    </Link>
  );
};
