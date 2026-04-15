import { useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "antd";

import { createApiRequest, createGithubRequest } from "./dashboardClient";
import { createDashboardAuthActions } from "./dashboardAuthActions";
import { buildLogsFromComments, normalizeExecutionDecisionGate, normalizePlanForm, normalizeProjectExecution, parseStatusFromComments, type IssueComment } from "./dashboardGithub";
import { createDashboardRefreshActions } from "./dashboardRefreshActions";
import {
  CLOSED_ANOMALIES_STORAGE_KEY,
  DASHBOARD_EXPEDITED_POLL_DURATION_MS,
  DASHBOARD_EXPEDITED_POLL_INTERVAL_MS,
  DASHBOARD_POLL_INTERVAL_MS,
  DEFAULT_API_BASE,
  GITHUB_TASK_REPO,
  IS_GITHUB_PAGES,
  STATUS_FILTER_ALL,
  getDashboardCopy,
  type DashboardShellViewModel,
  type DashboardTabId,
} from "./dashboardConstants";
import type {
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
import { buildUsageLimitSnapshots } from "./dashboardUsageUtils";
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
  RuntimeMode,
  StatusFilterValue,
  Task,
  ThemeMode,
  ToolLink,
  UsageOverview,
  WorkspaceAnomaly,
  WorkspaceLevel,
} from "./dashboardTypes";

export type DashboardController = {
  shell: DashboardShellViewModel;
  workspace: DashboardWorkspaceViewModel;
  tools: DashboardToolsViewModel;
  usage: DashboardUsageViewModel;
};

export function useDashboardController(): DashboardController {
  const runtimeMode: RuntimeMode = IS_GITHUB_PAGES ? "github-direct" : "local-api";
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
  const [githubToken, setGithubToken] = useState(localStorage.getItem("codex.githubAccessToken") || "");
  const [activeTab, setActiveTab] = useState<DashboardTabId>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingTaskMutations, setPendingTaskMutations] = useState<Record<string, PendingTaskMutation>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<ToolLink[]>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [usageSummary, setUsageSummary] = useState("");
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
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
  const [isMobileViewDrawerOpen, setIsMobileViewDrawerOpen] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [requirementStatusFilter, setRequirementStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [requirementPage, setRequirementPage] = useState(1);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const pollTokenRef = useRef(0);
  const taskRefreshRequestRef = useRef(0);
  const pendingTaskMutationsRef = useRef(pendingTaskMutations);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const [taskSyncState, setTaskSyncState] = useState<TaskSyncState>({ inFlight: false, lastSyncedAt: "" });
  const [expeditedPollUntil, setExpeditedPollUntil] = useState(0);
  const copy = useMemo(() => getDashboardCopy(locale), [locale]);
  const api = useMemo(() => createApiRequest(sessionToken), [sessionToken]);
  const githubRequest = useMemo(
    () => createGithubRequest(githubToken, locale === "zh-CN" ? "请先使用 GitHub 登录" : "Sign in with GitHub first"),
    [githubToken, locale],
  );
  const usageLimitSnapshots = useMemo(() => buildUsageLimitSnapshots(usage, locale), [locale, usage]);
  const {
    requirementPageSize,
    visibleTasks,
    visibleRequirements,
    selectedTask,
    selectedRequirement,
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    visibleWorkspaceAnomalies,
    visibleProjects,
    visibleApprovals,
    filteredProjects,
    filteredSelectedProjectRequirements,
    paginatedSelectedProjectRequirements,
    breadcrumbs,
    workspaceTitle,
    workspaceDescription,
    createLabel,
    openProject,
    openRequirement,
    openTaskRequirement,
    handleRequirementStatusFilterChange,
  } = useDashboardWorkspaceState({
    runtimeMode,
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
    requirementPage,
    setSelectedTaskId,
    setSelectedRequirementId,
    setSelectedProjectId,
    setWorkspaceLevel,
    setRequirementStatusFilter,
    setRequirementPage,
    detailTitle: copy.taskDetails,
  });

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
    setIsMobileNavOpen(false);
    setIsMobileViewDrawerOpen(false);
  }, [activeTab, locale, theme]);

  useEffect(() => {
    void refreshAll();
  }, [githubToken, runtimeMode, sessionToken]);

  useEffect(() => {
    const pollIntervalMs = Date.now() < expeditedPollUntil
      ? DASHBOARD_EXPEDITED_POLL_INTERVAL_MS
      : DASHBOARD_POLL_INTERVAL_MS;
    const interval = window.setInterval(() => {
      void refreshTasks();
      if (runtimeMode !== "github-direct") {
        void refreshApprovals();
      }
      void refreshUsage();
      void refreshAuth();
    }, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [expeditedPollUntil, githubToken, runtimeMode, sessionToken]);

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

  const { refreshAll, refreshHealth, refreshAuth, refreshProjects, refreshTasks, refreshApprovals, refreshTools, refreshUsage } = createDashboardRefreshActions({
    locale,
    runtimeMode,
    copy,
    githubToken,
    visibleTasks,
    visibleRequirements,
    api,
    githubRequest,
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
    summarizeError,
  });

  const { onCreateProject, onCreateTask, mutateTask, respondToTask } = createDashboardTaskActions({
    locale,
    runtimeMode,
    authConfig,
    visibleTasks,
    tasks,
    api,
    githubRequest,
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
    runtimeMode,
    githubToken,
    authConfig,
    deviceLogin,
    api,
    refreshAll,
    pollTokenRef,
    setGithubToken,
    setSessionToken,
    setPendingTaskMutations,
    setDeviceLogin,
    setCopyState,
    setTransientNotice,
    summarizeError,
  });


  const shell: DashboardShellViewModel = {
    runtimeMode,
    locale,
    theme,
    activeTab,
    isMobile,
    isMobileNavOpen,
    isMobileViewDrawerOpen,
    authConfig,
    deviceLogin,
    copyState,
    notices,
    copy,
    apiBaseLabel: runtimeMode === "github-direct" ? GITHUB_TASK_REPO : DEFAULT_API_BASE,
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    onChangeLocale: setLocale,
    onChangeTab: (next) => {
      setActiveTab(next);
      setIsMobileViewDrawerOpen(false);
    },
    onOpenMobileNav: () => setIsMobileNavOpen(true),
    onCloseMobileNav: () => setIsMobileNavOpen(false),
    onOpenMobileViewDrawer: () => setIsMobileViewDrawerOpen(true),
    onCloseMobileViewDrawer: () => setIsMobileViewDrawerOpen(false),
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
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    visibleWorkspaceAnomalies,
    visibleApprovals,
    taskSyncState,
    projectStatusFilter,
    requirementStatusFilter,
    onProjectStatusFilterChange: setProjectStatusFilter,
    onRequirementStatusFilterChange: handleRequirementStatusFilterChange,
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
  };

  const toolsView: DashboardToolsViewModel = {
    locale,
    tools,
  };

  return {
    shell,
    workspace,
    tools: toolsView,
    usage: usageView,
  };
}
