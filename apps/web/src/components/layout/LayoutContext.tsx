import React, { createContext, useContext } from "react";

interface LayoutContextValue {
  sidebarCollapsed: boolean;
  isSidebarAnimating: boolean;
}

const SidebarCollapsedContext = createContext(false);
const SidebarAnimatingContext = createContext(false);

export function LayoutProvider({
  value,
  children,
}: {
  value: LayoutContextValue;
  children: React.ReactNode;
}) {
  return (
    <SidebarCollapsedContext.Provider value={value.sidebarCollapsed}>
      <SidebarAnimatingContext.Provider value={value.isSidebarAnimating}>{children}</SidebarAnimatingContext.Provider>
    </SidebarCollapsedContext.Provider>
  );
}

export function useLayoutContext() {
  return {
    sidebarCollapsed: useContext(SidebarCollapsedContext),
    isSidebarAnimating: useContext(SidebarAnimatingContext),
  };
}

export function useSidebarAnimating() {
  return useContext(SidebarAnimatingContext);
}
