import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Header } from "./Header";
import { LayoutProvider } from "./LayoutContext";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_ANIMATION_MS = 500;
const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const SIDEBAR_EXPANDED_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const HEADER_HEIGHT_PX = 64;

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isSidebarAnimating, setIsSidebarAnimating] = useState(false);
  const [contentTransform, setContentTransform] = useState(0);
  const [isContentTransitioning, setIsContentTransitioning] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const shouldTransformContent = contentTransform !== 0 || isContentTransitioning;

  useEffect(() => {
    if (!isSidebarAnimating) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSidebarAnimating(false);
      setIsContentTransitioning(false);
    }, SIDEBAR_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [isSidebarAnimating]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    const currentWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
    const nextWidth = collapsed ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    setIsSidebarAnimating(true);
    setIsContentTransitioning(false);
    setContentTransform(currentWidth - nextWidth);
    setCollapsed((current) => !current);

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setIsContentTransitioning(true);
        setContentTransform(0);
      });
    });
  }, [collapsed]);

  return (
    <LayoutProvider value={{ sidebarCollapsed: collapsed, isSidebarAnimating }}>
      <div className="flex min-h-screen overflow-x-hidden bg-surface">
        <Sidebar collapsed={collapsed} onToggle={handleToggle} />
        <div
          style={{
            paddingLeft: sidebarWidth,
            transform: shouldTransformContent ? `translateX(${contentTransform}px)` : undefined,
            transitionDuration: isContentTransitioning ? `${SIDEBAR_ANIMATION_MS}ms` : "0ms",
            transitionTimingFunction: SIDEBAR_EASING,
          }}
        className={cn("box-border min-w-0 flex-1", shouldTransformContent && "transition-transform will-change-transform")}
      >
          <Header sidebarWidth={sidebarWidth} />
          <main className="p-8 pb-24" style={{ paddingTop: HEADER_HEIGHT_PX + 32 }}>
            {children}
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
};
