import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { footerMenuRoutes, mainMenuRoutes, settingsRootRoute } from "../../routes/appRoutes";
import { canAccessRoute } from "../../routes/routeAccess";
import { SidebarItem } from "./SidebarItem";

interface SidebarMenuProps {
  collapsed: boolean;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleMainRoutes = mainMenuRoutes.filter((route) => canAccessRoute(user, route));
  const visibleSettingsRoutes = footerMenuRoutes.filter((route) => canAccessRoute(user, route));
  const settingsActive = location.pathname.startsWith("/settings");
  const [settingsExpanded, setSettingsExpanded] = React.useState(settingsActive);

  React.useEffect(() => {
    if (settingsActive) {
      setSettingsExpanded(true);
    }
  }, [settingsActive]);

  return (
    <nav className="flex flex-1 flex-col">
      <div className="space-y-1">
        {visibleMainRoutes.map((route) => (
          <SidebarItem key={route.path} collapsed={collapsed} icon={route.icon} label={route.label} to={route.path} />
        ))}
      </div>
      <div className="mt-auto space-y-1 pt-2">
        <SidebarItem
          collapsed={collapsed}
          icon={settingsRootRoute.icon}
          label={settingsRootRoute.label}
          to={settingsRootRoute.path}
          active={settingsActive}
          onClick={
            collapsed
              ? () => navigate(settingsRootRoute.path)
              : () => setSettingsExpanded((current) => !current)
          }
          trailingIcon={
            collapsed ? undefined : (
              <motion.span
                initial={false}
                animate={{ rotate: settingsExpanded ? 0 : -90 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex"
              >
                <ChevronDown size={14} className="text-on-surface-variant" />
              </motion.span>
            )
          }
        />
        <AnimatePresence initial={false}>
          {!collapsed && settingsExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="ml-7 space-y-1 border-l border-surface-container pl-3 pt-1">
                {visibleSettingsRoutes.map((route) => (
                  <SidebarItem key={route.path} collapsed={false} compact icon={route.icon} label={route.label} to={route.path} />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </nav>
  );
};
