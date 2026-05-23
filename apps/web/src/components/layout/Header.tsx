import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Bug, ChevronDown, HelpCircle, PackageCheck, ShieldAlert, Trash2, TriangleAlert, X } from "lucide-react";
import { clearLogEntries, getLogEntries, subscribeLogEntries, type LogEntry, type LogLevel } from "../../lib/logger";
import { useAuth } from "../../providers/AuthProvider";

const HEADER_HEIGHT_PX = 64;
const HEADER_HIDE_THRESHOLD_PX = 160;
const SIDEBAR_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const NOTIFICATION_DRAWER_WIDTH = 380;
const LOG_LEVEL_FILTERS: Array<LogLevel | "all"> = ["all", "debug", "info", "warn", "error"];
const LOG_LEVEL_LABELS: Record<LogLevel | "all", string> = {
  all: "全部",
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
};

const NOTIFICATION_ITEMS = [
  {
    id: "batch-risk",
    title: "发现 1 个异常批次",
    description: "库存状态页中有紧急批次需要处理，建议优先核查当前批次数量与效期。",
    time: "刚刚",
    icon: TriangleAlert,
    iconClassName: "bg-red-50 text-red-600",
  },
  {
    id: "loss-review",
    title: "报损记录已同步",
    description: "最新报损操作已经写入历史记录，可前往报损管理页继续复核。",
    time: "10 分钟前",
    icon: ShieldAlert,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  {
    id: "batch-created",
    title: "新增库存已入库",
    description: "入库操作完成后已刷新库存概览，最新数据可在库存状态页查看。",
    time: "今天 09:24",
    icon: PackageCheck,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
] as const;

interface HeaderProps {
  sidebarWidth: number;
}

type NotificationTab = "messages" | "logs";

function getLogLevelClassName(level: LogLevel) {
  switch (level) {
    case "debug":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

function formatLogTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function hasLogDetails(entry: LogEntry) {
  return Boolean(entry.event || entry.details || entry.error);
}

function stringifyLogDetails(entry: LogEntry) {
  return JSON.stringify(
    {
      event: entry.event,
      details: entry.details,
      error: entry.error,
    },
    null,
    2,
  );
}

export const Header: React.FC<HeaderProps> = ({ sidebarWidth }) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("messages");
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => getLogEntries());
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevel | "all">("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const hasRuntimeAlert = logEntries.some((entry) => entry.level === "warn" || entry.level === "error");
  const greetingName = user?.displayName || user?.username || "用户";
  const filteredLogEntries =
    logLevelFilter === "all" ? logEntries : logEntries.filter((entry) => entry.level === logLevelFilter);

  useEffect(() => {
    return subscribeLogEntries(setLogEntries);
  }, []);

  useEffect(() => {
    if (logLevelFilter !== "all" && !logEntries.some((entry) => entry.level === logLevelFilter)) {
      setLogLevelFilter("all");
    }
  }, [logEntries, logLevelFilter]);

  useEffect(() => {
    const handleScroll = () => {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;

      window.requestAnimationFrame(() => {
        const nextScrollY = window.scrollY;
        const scrollingUp = nextScrollY < lastScrollYRef.current;
        const scrollingDown = nextScrollY > lastScrollYRef.current;

        if (nextScrollY <= HEADER_HIDE_THRESHOLD_PX) {
          setVisible(true);
        } else if (scrollingUp) {
          setVisible(true);
        } else if (scrollingDown) {
          setVisible(false);
        }

        lastScrollYRef.current = nextScrollY;
        tickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notificationsOpen]);

  return (
    <>
      <header
        style={{
          left: sidebarWidth,
          height: visible ? HEADER_HEIGHT_PX : 0,
          transitionTimingFunction: SIDEBAR_EASING,
        }}
        className="glass-header fixed right-0 top-0 z-30 overflow-hidden border-surface-container/50 transition-[left,height,border-color] duration-500"
      >
        <div
          className="flex h-16 items-center justify-between px-8 transition-[transform,opacity] duration-300"
          style={{ transform: visible ? "translateY(0)" : "translateY(-100%)", opacity: visible ? 1 : 0 }}
        >
          <div className="flex-1" />

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 border-r border-surface-container pr-6">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(true);
                  if (hasRuntimeAlert) {
                    setActiveTab("logs");
                  }
                }}
                className="relative text-on-surface-variant transition-colors hover:text-primary"
                aria-label="打开消息通知"
                title="打开消息通知"
              >
                <Bell size={20} />
                {hasRuntimeAlert ? (
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-full border-2 border-white bg-error" />
                ) : null}
              </button>
              <button type="button" className="text-on-surface-variant transition-colors hover:text-primary">
                <HelpCircle size={20} />
              </button>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-on-surface">{`你好，${greetingName}`}</p>
              <p className="text-[10px] text-on-surface-variant">{new Date().toLocaleDateString("zh-CN")}</p>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {notificationsOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="关闭消息通知"
              className="fixed inset-0 z-40 bg-slate-950/18 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onClick={() => setNotificationsOpen(false)}
            />
            <motion.aside
              initial={{ x: NOTIFICATION_DRAWER_WIDTH, opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: NOTIFICATION_DRAWER_WIDTH, opacity: 0.8 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-3 right-3 top-3 z-50 flex w-[380px] flex-col overflow-hidden rounded-3xl border border-surface-container bg-surface-container-lowest shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-surface-container px-6 py-5">
                <div>
                  <p className="text-lg font-bold text-on-surface">消息通知</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    库存消息与运行日志会集中展示在这里。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-surface-container bg-surface text-on-surface-variant transition-colors hover:text-primary"
                  aria-label="关闭消息通知"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-surface-container px-5 py-3">
                {[
                  { id: "messages" as const, label: "消息通知" },
                  { id: "logs" as const, label: `运行日志 ${logEntries.length ? `(${logEntries.length})` : ""}` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {activeTab === "messages" ? (
                  <div className="space-y-4">
                    {NOTIFICATION_ITEMS.map((item) => {
                      const Icon = item.icon;

                      return (
                        <section
                          key={item.id}
                          className="rounded-3xl border border-surface-container bg-surface px-4 py-4 shadow-sm"
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.iconClassName}`}
                            >
                              <Icon size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-on-surface">{item.title}</p>
                                <span className="shrink-0 text-[11px] text-on-surface-variant">{item.time}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{item.description}</p>
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {LOG_LEVEL_FILTERS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setLogLevelFilter(level)}
                            className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                              logLevelFilter === level
                                ? "border-primary bg-primary text-white"
                                : "border-surface-container bg-surface text-on-surface-variant hover:text-primary"
                            }`}
                          >
                            {LOG_LEVEL_LABELS[level]}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          clearLogEntries();
                          setExpandedLogId(null);
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-surface-container bg-surface text-on-surface-variant transition-colors hover:text-error"
                        aria-label="清空运行日志"
                        title="清空运行日志"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {filteredLogEntries.length === 0 ? (
                      <section className="rounded-3xl border border-dashed border-surface-container bg-surface px-5 py-8 text-center">
                        <Bug size={24} className="mx-auto text-on-surface-variant" />
                        <p className="mt-3 text-sm font-bold text-on-surface">暂无运行日志</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          调试模式或 .env 开启日志后，关键运行信息会显示在这里。
                        </p>
                      </section>
                    ) : (
                      filteredLogEntries
                        .slice()
                        .reverse()
                        .map((entry) => {
                          const expanded = expandedLogId === entry.id;

                          return (
                            <section
                              key={entry.id}
                              className="rounded-3xl border border-surface-container bg-surface px-4 py-4 shadow-sm"
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getLogLevelClassName(
                                    entry.level,
                                  )}`}
                                >
                                  {entry.level}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="truncate text-sm font-bold text-on-surface">{entry.message}</p>
                                    <span className="shrink-0 text-[11px] text-on-surface-variant">
                                      {formatLogTime(entry.timestamp)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-on-surface-variant">
                                    {entry.scope}
                                    {entry.event ? ` / ${entry.event}` : ""}
                                  </p>
                                </div>
                                {hasLogDetails(entry) ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(expanded ? null : entry.id)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                                    aria-label="展开日志详情"
                                  >
                                    <ChevronDown
                                      size={16}
                                      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                                    />
                                  </button>
                                ) : null}
                              </div>
                              {expanded ? (
                                <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant">
                                  {stringifyLogDetails(entry)}
                                </pre>
                              ) : null}
                            </section>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
};
