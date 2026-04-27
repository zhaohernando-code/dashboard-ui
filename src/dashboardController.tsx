import { useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "antd";

import { createApiRequest } from "./dashboardClient";
import { createDashboardAuthActions } from "./dashboardAuthActions";
import { createDashboardRefreshActions, normalizeApiTask } from "./dashboardRefreshActions";
import {
  CLOSED_ANOMALIES_STORAGE_KEY,
  DASHBOARD_EXPEDITED_POLL_DURATION_MS,
  DASHBOARD_EXPEDITED_POLL_INTERVAL_MS,
  DASHBOARD_POLL_INTERVAL_MS,
  STATUS_FILTER_ALL,
  getDashboardCopy,
  type DashboardShellViewModel,
  type DashboardTabId,
} from "./dashboardConstants";
import type {
  DashboardWatchdogViewModel,
  DashboardToolsViewModel,
  DashboardUsageViewModel,
  DashboardWorkspaceViewModel,
  PendingTaskMutation,
  TaskSyncState,
} from "./dashboardControlTypes";
import {
  getTaskDisplayedStatusColor,
  getTaskDisplayedStatusText,
} from "./dashboardPendingMutations";
import {
  getProjectDisplayName,
} from "./dashboardProjectUtils";
import { buildModelStatusSnapshots, buildUsageLimitSnapshots } from "./dashboardUsageUtils";
import { createDashboardTaskActions } from "./dashboardTaskActions";
import { useDashboardWorkspaceState } from "./useDashboardWorkspaceState";
import type {
  Approval,
  AuthConfig,
  CopyState,
  CreateDialogMode,
  DeviceLoginSession,
  DismissedAnomaly,
  Locale,
  NoticeItem,
  NoticeTone,
  PlatformHealth,
  Project,
  StatusFilterValue,
  Task,
  TaskLog,
  TaskLogFeed,
  ThemeMode,
  ToolLink,
  UsageOverview,
  WatchdogOverview,
  WorkspaceAnomaly,
  WorkspaceLevel,
} from "./dashboardTypes";

const TASK_LOG_WINDOW_SIZE = 200;

export type DashboardController = {
  shell: DashboardShellViewModel;
  workspace: DashboardWorkspaceViewModel;
  watchdog: DashboardWatchdogViewModel;
  tools: DashboardToolsViewModel;
  usage: DashboardUsageViewModel;
};

export function useDashboardController(): DashboardController {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("codex.locale");
    if (saved === "zh-CN" || saved === "en-US") return saved;
    return navigator.language.startsWith("zh") ? "zh-CN" : "en-US";
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("codex.theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [sessionToken, setSessionToken] = useState(localStorage.getItem("codex.sessionToken") || "");
  const [activeTab, setActiveTab] = useState<DashboardTabId>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDetailsById, setTaskDetailsById] = useState<Record<string, Task>>({});
  const [taskLogsById, setTaskLogsById] = useState<Record<string, TaskLogFeed>>({});
  const [pendingTaskMutations, setPendingTaskMutations] = useState<Record<string, PendingTaskMutation>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<ToolLink[]>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [usageSummary, setUsageSummary] = useState("");
  const [usageRefreshing, setUsageRefreshing] = useState(false);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [watchdogOverview, setWatchdogOverview] = useState<WatchdogOverview | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [workspaceLevel, setWorkspaceLevel] = useState<WorkspaceLevel>("projects");
  const [createDialogMode, setCreateDialogMode] = useState<CreateDialogMode | null>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [deviceLogin, setDeviceLogin] = useState<DeviceLoginSession | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<DismissedAnomaly[]>(() => {
    try {
      const saved = localStorage.getItem(CLOSED_ANOMALIES_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as DismissedAnomaly[]) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is DismissedAnomaly =>
              Boolean(item) &&
              typeof item.id === "string" &&
              typeof item.dismissedAt === "string",
          )
        : [];
    } catch {
      return [];
    }
  });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedTaskDetailLoading, setSelectedTaskDetailLoading] = useState(false);
  const [selectedTaskDetailError, setSelectedTaskDetailError] = useState("");
  const [selectedTaskLogsLoading, setSelectedTaskLogsLoading] = useState(false);
  const [selectedTaskLogsError, setSelectedTaskLogsError] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [requirementStatusFilter, setRequirementStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [showUnarchivedOnly, setShowUnarchivedOnly] = useState(true);
  const [requirementPage, setRequirementPage] = useState(1);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const pollTokenRef = useRef(0);
  const autoRefreshCycleRef = useRef<() => Promise<void>>(async () => {});
  const autoRefreshTimerRef = useRef<number | null>(null);
  const taskSyncInFlightRef = useRef(false);
  const taskRefreshRequestRef = useRef(0);
  const taskDetailRequestRef = useRef(0);
  const taskLogsRequestRef = useRef(0);
  const pendingTaskMutationsRef = useRef(pendingTaskMutations);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const [taskSyncState, setTaskSyncState] = useState<TaskSyncState>({ inFlight: false });
  const [expeditedPollUntil, setExpeditedPollUntil] = useState(0);
  const copy = useMemo(() => getDashboardCopy(locale), [locale]);
  const api = useMemo(() => createApiRequest(sessionToken), [sessionToken]);
  const usageLimitSnapshots = useMemo(() => buildUsageLimitSnapshots(usage, locale), [locale, usage]);
  const modelStatusSnapshots = useMemo(() => buildModelStatusSnapshots(usage, locale), [locale, usage]);
  const {
    requirementPageSize,
    visibleTasks,
    visibleRequirements,
    selectedTask: selectedTaskSummary,
    selectedRequirement,
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    visibleWorkspaceAnomalies,
    visibleProjects,
    visibleApprovals,
    filteredProjects,
    filteredSelectedProjectRequirements,
    paginatedSelectedProjectRequirements,
    visibleQueueItems,
    breadcrumbs,
    workspaceTitle,
    workspaceDescription,
    createLabel,
    openProject,
    openRequirement,
    openTaskRequirement,
    handleRequirementStatusFilterChange,
  } = useDashboardWorkspaceState({
    locale,
    isMobile,
    projects,
    tasks,
    pendingTaskMutations,
    approvals,
    dismissedAnomalies,
    selectedTaskId,
    selectedRequirementId,
    selectedProjectId,
    workspaceLevel,
    projectStatusFilter,
    requirementStatusFilter,
    showUnarchivedOnly,
    requirementPage,
    setSelectedTaskId,
    setSelectedRequirementId,
    setSelectedProjectId,
    setWorkspaceLevel,
    setRequirementStatusFilter,
    setRequirementPage,
    detailTitle: copy.taskDetails,
  });

  const selectedTask = useMemo(() => {
    if (!selectedTaskSummary) {
      return null;
    }
    const taskDetail = taskDetailsById[selectedTaskSummary.id];
    const taskLogFeed = taskLogsById[selectedTaskSummary.id];
    return {
      ...selectedTaskSummary,
      ...taskDetail,
      logs: taskLogFeed?.logs ?? taskDetail?.logs ?? selectedTaskSummary.logs ?? [],
      logTotal: taskLogFeed?.total ?? taskDetail?.logTotal ?? selectedTaskSummary.logTotal,
      logLoadedFrom: taskLogFeed?.loadedFrom ?? taskDetail?.logLoadedFrom ?? selectedTaskSummary.logLoadedFrom,
      logNextCursor: taskLogFeed?.nextCursor ?? taskDetail?.logNextCursor ?? selectedTaskSummary.logNextCursor,
      logTruncated: taskLogFeed?.truncated ?? taskDetail?.logTruncated ?? selectedTaskSummary.logTruncated,
      logHasMore: taskLogFeed?.hasMore ?? taskDetail?.logHasMore ?? selectedTaskSummary.logHasMore,
    } satisfies Task;
  }, [selectedTaskSummary, taskDetailsById, taskLogsById]);
  const selectedTaskIsPlaceholder = selectedTaskSummary?.id?.startsWith("pending-local-") ?? false;

  useEffect(() => {
    localStorage.setItem("codex.locale", locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem("codex.theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    pendingTaskMutationsRef.current = pendingTaskMutations;
  }, [pendingTaskMutations]);

  useEffect(() => {
    taskSyncInFlightRef.current = taskSyncState.inFlight;
  }, [taskSyncState.inFlight]);

  useEffect(() => {
    setTaskDetailsById({});
    setTaskLogsById({});
    setSelectedTaskDetailLoading(false);
    setSelectedTaskDetailError("");
    setSelectedTaskLogsLoading(false);
    setSelectedTaskLogsError("");
  }, [sessionToken]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeTab, locale, theme]);

  useEffect(() => {
    void refreshAll();
  }, [sessionToken]);

  useEffect(() => {
    if (!expeditedPollUntil) {
      return;
    }
    const remainingMs = expeditedPollUntil - Date.now();
    if (remainingMs <= 0) {
      setExpeditedPollUntil(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setExpeditedPollUntil(0);
    }, remainingMs + 50);
    return () => window.clearTimeout(timer);
  }, [expeditedPollUntil]);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CLOSED_ANOMALIES_STORAGE_KEY, JSON.stringify(dismissedAnomalies));
  }, [dismissedAnomalies]);

  useEffect(() => {
    if (!selectedTaskSummary) {
      setSelectedTaskDetailLoading(false);
      setSelectedTaskDetailError("");
      return;
    }
    if (selectedTaskIsPlaceholder) {
      setSelectedTaskDetailLoading(false);
      setSelectedTaskDetailError("");
      return;
    }
    const requestId = ++taskDetailRequestRef.current;
    const taskId = selectedTaskSummary.id;
    setSelectedTaskDetailLoading(true);
    setSelectedTaskDetailError("");
    void api<{ task: Task }>(`/api/tasks/${taskId}`)
      .then((payload) => {
        if (requestId !== taskDetailRequestRef.current) {
          return;
        }
        setTaskDetailsById((current) => ({
          ...current,
          [taskId]: normalizeApiTask(payload.task, locale),
        }));
        setSelectedTaskDetailLoading(false);
      })
      .catch((error) => {
        if (requestId !== taskDetailRequestRef.current) {
          return;
        }
        setSelectedTaskDetailLoading(false);
        setSelectedTaskDetailError(summarizeError(error));
      });
  }, [api, locale, selectedTaskIsPlaceholder, selectedTaskSummary?.id, selectedTaskSummary?.updatedAt]);

  useEffect(() => {
    if (!selectedTaskSummary) {
      setSelectedTaskLogsLoading(false);
      setSelectedTaskLogsError("");
      return;
    }
    if (selectedTaskIsPlaceholder) {
      setSelectedTaskLogsLoading(false);
      setSelectedTaskLogsError("");
      return;
    }
    const requestId = ++taskLogsRequestRef.current;
    const taskId = selectedTaskSummary.id;
    const existingFeed = taskLogsById[taskId];
    const requestPath = existingFeed
      ? `/api/tasks/${taskId}/logs?cursor=${existingFeed.nextCursor}&limit=${TASK_LOG_WINDOW_SIZE}`
      : `/api/tasks/${taskId}/logs?limit=${TASK_LOG_WINDOW_SIZE}`;
    setSelectedTaskLogsLoading(true);
    setSelectedTaskLogsError("");
    void api<TaskLogFeed>(requestPath)
      .then((payload) => {
        if (requestId !== taskLogsRequestRef.current) {
          return;
        }
        setTaskLogsById((current) => ({
          ...current,
          [taskId]: (() => {
            const normalizedLogs: TaskLog[] = (payload.logs || []).map((entry) => ({
              ...entry,
              audience: entry.audience === "operator" ? ("operator" as const) : ("raw" as const),
            }));
            const baseLogs = existingFeed ? (current[taskId]?.logs || []) : [];
            const mergedLogs = [...baseLogs, ...normalizedLogs].slice(-TASK_LOG_WINDOW_SIZE);
            const nextCursor = typeof payload.nextCursor === "number"
              ? payload.nextCursor
              : (existingFeed ? current[taskId]?.nextCursor || 0 : normalizedLogs.length);
            return {
              logs: mergedLogs,
              total: typeof payload.total === "number" ? payload.total : mergedLogs.length,
              returned: typeof payload.returned === "number" ? payload.returned : normalizedLogs.length,
              limit: typeof payload.limit === "number" ? payload.limit : TASK_LOG_WINDOW_SIZE,
              loadedFrom: Math.max(0, nextCursor - mergedLogs.length),
              nextCursor,
              hasMore: Boolean(payload.hasMore),
              truncated: Math.max(0, nextCursor - mergedLogs.length) > 0 || Boolean(payload.truncated),
            } satisfies TaskLogFeed;
          })(),
        }));
        setSelectedTaskLogsLoading(false);
      })
      .catch((error) => {
        if (requestId !== taskLogsRequestRef.current) {
          return;
        }
        setSelectedTaskLogsLoading(false);
        setSelectedTaskLogsError(summarizeError(error));
      });
  }, [api, selectedTaskIsPlaceholder, selectedTaskSummary?.id, selectedTaskSummary?.updatedAt, selectedTaskSummary?.lastStatusCommentAt]);

  function summarizeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function setTransientNotice(message: string, tone: NoticeTone = "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 4500);
  }

  function dismissAnomaly(anomaly: WorkspaceAnomaly) {
    setDismissedAnomalies((current) => {
      if (current.some((item) => item.id === anomaly.id)) return current;
      return [
        {
          id: anomaly.id,
          dismissedAt: new Date().toISOString(),
        },
        ...current,
      ];
    });
    setTransientNotice(locale === "zh-CN" ? "异常已标记为已处理，不再提示" : "Anomaly marked handled and hidden from alerts", "success");
  }

  function startExpeditedTaskPolling() {
    setExpeditedPollUntil(Date.now() + DASHBOARD_EXPEDITED_POLL_DURATION_MS);
  }

  const { refreshAll, refreshHealth, refreshAuth, refreshProjects, refreshTasks, refreshApprovals, refreshTools, refreshUsage, refreshWatchdog } = createDashboardRefreshActions({
    locale,
    copy,
    api,
    selectedProjectIdRef,
    selectedTaskIdRef,
    pendingTaskMutationsRef,
    taskRefreshRequestRef,
    setConnectionStatus,
    setPlatformHealth,
    setAuthConfig,
    setAuthStatus,
    setProjects,
    setSelectedProjectId,
    setTasks,
    setPendingTaskMutations,
    setTaskSyncState,
    setSelectedTaskId,
    setApprovals,
    setTools,
    setUsage,
    setUsageSummary,
    setWatchdogOverview,
    summarizeError,
  });

  useEffect(() => {
    autoRefreshCycleRef.current = async () => {
      if (taskSyncInFlightRef.current) {
        return;
      }
      await Promise.all([refreshTasks({ trigger: "auto" }), refreshApprovals(), refreshUsage(), refreshAuth(), refreshWatchdog()]);
    };
  }, [refreshApprovals, refreshAuth, refreshTasks, refreshUsage, refreshWatchdog]);

  async function handleRefreshUsage() {
    setUsageRefreshing(true);
    try {
      await refreshUsage({ manual: true });
    } finally {
      setUsageRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    function clearScheduledPoll() {
      if (autoRefreshTimerRef.current !== null) {
        window.clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    }

    function scheduleNextPoll() {
      if (cancelled) {
        return;
      }
      clearScheduledPoll();
      const pollIntervalMs = (watchdogOverview?.activeSession || Date.now() < expeditedPollUntil)
        ? DASHBOARD_EXPEDITED_POLL_INTERVAL_MS
        : DASHBOARD_POLL_INTERVAL_MS;
      autoRefreshTimerRef.current = window.setTimeout(() => {
        void autoRefreshCycleRef.current()
          .catch(() => {})
          .finally(() => {
            scheduleNextPoll();
          });
      }, pollIntervalMs);
    }

    scheduleNextPoll();
    return () => {
      cancelled = true;
      clearScheduledPoll();
    };
  }, [expeditedPollUntil, sessionToken, watchdogOverview?.activeSession?.id]);

  async function toggleWatchdogEnabled(next: boolean) {
    try {
      const payload = await api<{ enabled: boolean; watchdog: WatchdogOverview | null }>("/api/watchdog/config", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });
      setWatchdogOverview(payload.watchdog);
      setTransientNotice(
        next
          ? (locale === "zh-CN" ? "看护模式已开启" : "Watchdog mode enabled")
          : (locale === "zh-CN" ? "看护模式已关闭" : "Watchdog mode disabled"),
        "success",
      );
      await refreshWatchdog();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function acknowledgeWatchdog(jobId: string) {
    try {
      await api(`/api/watchdog/${jobId}/acknowledge`, {
        method: "POST",
      });
      setTransientNotice(locale === "zh-CN" ? "已确认看护暂停，队列可继续" : "Watchdog pause acknowledged", "success");
      await Promise.all([refreshWatchdog(), refreshTasks(), refreshApprovals()]);
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  function openTaskFromWatchdog(taskId: string) {
    if (!taskId) {
      return;
    }
    setSelectedTaskId(taskId);
    setWorkspaceLevel("detail");
    setActiveTab("quest-center");
  }

  const watchdogBanner = watchdogOverview?.activeSession
    ? {
        title: locale === "zh-CN"
          ? `看护中 · ${watchdogOverview.activeSession.taskTitle || watchdogOverview.activeSession.taskId}`
          : `Watchdog active · ${watchdogOverview.activeSession.taskTitle || watchdogOverview.activeSession.taskId}`,
        detail: watchdogOverview.activeSession.summary
          || watchdogOverview.pauseReason
          || (locale === "zh-CN" ? "看护正在校验当前任务状态。" : "Watchdog is validating the current task state."),
        tone: watchdogOverview.activeSession.requiresAcknowledgement ? ("warning" as const) : ("info" as const),
        sessionId: watchdogOverview.activeSession.id,
        requiresAcknowledgement: watchdogOverview.activeSession.requiresAcknowledgement,
      }
    : null;

  const { onCreateProject, onCreateTask, mutateTask, respondToTask } = createDashboardTaskActions({
    locale,
    visibleTasks,
    tasks,
    api,
    setPendingTaskMutations,
    setSelectedProjectId,
    setSelectedTaskId,
    setWorkspaceLevel,
    setCreateDialogMode,
    setTransientNotice,
    startExpeditedTaskPolling,
    refreshAll,
    refreshTasks,
    refreshApprovals,
    summarizeError,
  });
  const { loginWithGithub, copyDeviceCode, cancelDeviceLogin, logout } = createDashboardAuthActions({
    locale,
    authConfig,
    deviceLogin,
    api,
    refreshAll,
    pollTokenRef,
    setSessionToken,
    setPendingTaskMutations,
    setDeviceLogin,
    setCopyState,
    setTransientNotice,
    summarizeError,
  });


  const shell: DashboardShellViewModel = {
    locale,
    theme,
    activeTab,
    isMobile,
    isMobileNavOpen,
    authConfig,
    deviceLogin,
    copyState,
    notices,
    copy,
    watchdogEnabled: Boolean(watchdogOverview?.enabled),
    watchdogActive: Boolean(watchdogOverview?.activeSession),
    watchdogBanner,
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    onChangeLocale: setLocale,
    onChangeTab: (next) => {
      setActiveTab(next);
      setIsMobileNavOpen(false);
    },
    onToggleWatchdog: toggleWatchdogEnabled,
    onAcknowledgeWatchdog: acknowledgeWatchdog,
    onOpenMobileNav: () => setIsMobileNavOpen(true),
    onCloseMobileNav: () => setIsMobileNavOpen(false),
    onLogin: loginWithGithub,
    onLogout: logout,
    onCopyDeviceCode: copyDeviceCode,
    onCancelDeviceLogin: cancelDeviceLogin,
  };

  const workspace: DashboardWorkspaceViewModel = {
    locale,
    copy,
    isMobile,
    workspaceLevel,
    breadcrumbs,
    workspaceTitle,
    workspaceDescription,
    createLabel,
    createDialogMode,
    visibleProjects,
    selectedProjectId,
    filteredProjects,
    paginatedSelectedProjectRequirements,
    filteredSelectedProjectRequirements,
    requirementPage,
    requirementPageSize,
    selectedTask,
    selectedRequirement,
    selectedTaskDetailLoading,
    selectedTaskDetailError,
    selectedTaskLogsLoading,
    selectedTaskLogsError,
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    visibleWorkspaceAnomalies,
    visibleApprovals,
    visibleQueueItems,
    taskSyncState,
    projectStatusFilter,
    requirementStatusFilter,
    showUnarchivedOnly,
    onProjectStatusFilterChange: setProjectStatusFilter,
    onRequirementStatusFilterChange: handleRequirementStatusFilterChange,
    onToggleShowUnarchivedOnly: setShowUnarchivedOnly,
    onRequirementPageChange: setRequirementPage,
    onRefreshAll: refreshAll,
    onRefreshTasks: refreshTasks,
    onOpenCreateDialog: setCreateDialogMode,
    onCloseCreateDialog: () => setCreateDialogMode(null),
    onCreateProject,
    onCreateTask,
    onOpenProject: openProject,
    onOpenRequirement: openRequirement,
    onOpenTaskRequirement: openTaskRequirement,
    onMutateTask: mutateTask,
    onRespondToTask: respondToTask,
    onDismissAnomaly: dismissAnomaly,
    getProjectDisplayName,
    getTaskDisplayedStatusText,
    getTaskDisplayedStatusColor,
  };

  const usageView: DashboardUsageViewModel = {
    locale,
    usage,
    usageSummary,
    platformHealth,
    usageLimitSnapshots,
    modelStatusSnapshots,
    usageRefreshing,
    onRefreshUsage: handleRefreshUsage,
  };

  const toolsView: DashboardToolsViewModel = {
    locale,
    tools,
  };

  const watchdogView: DashboardWatchdogViewModel = {
    locale,
    overview: watchdogOverview,
    activeSession: watchdogOverview?.activeSession || null,
    onToggleEnabled: toggleWatchdogEnabled,
    onAcknowledge: acknowledgeWatchdog,
    onOpenTask: openTaskFromWatchdog,
  };

  return {
    shell,
    workspace,
    watchdog: watchdogView,
    tools: toolsView,
    usage: usageView,
  };
}
