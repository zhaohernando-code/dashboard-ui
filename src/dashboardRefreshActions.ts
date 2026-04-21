import type { MutableRefObject } from "react";

import type { DashboardCopy } from "./dashboardConstants";
import { normalizeExecutionDecisionGate, normalizePlanForm, normalizeProjectExecution } from "./dashboardGithub";
import { reconcilePendingTaskMutations } from "./dashboardPendingMutations";
import { buildPlanFormFromPreview } from "./dashboardProjectUtils";
import { getTaskDisplayStatus, getTaskPendingReason, taskNeedsUserAttention } from "./dashboardTaskState";
import {
  buildUsageSummary,
  normalizePlatformHealth,
  normalizeUsageOverview,
} from "./dashboardUsageUtils";
import { normalizeWatchdogOverview } from "./dashboardWatchdogUtils";
import type {
  Approval,
  AuthConfig,
  Locale,
  PlatformHealth,
  Project,
  Task,
  ToolLink,
  UsageOverview,
  WatchdogOverview,
} from "./dashboardTypes";
import type { PendingTaskMutation, TaskSyncState, TaskSyncTrigger } from "./dashboardControlTypes";

type DashboardRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type DashboardRefreshActionsInput = {
  locale: Locale;
  copy: DashboardCopy;
  api: DashboardRequest;
  selectedProjectIdRef: MutableRefObject<string>;
  selectedTaskIdRef: MutableRefObject<string>;
  pendingTaskMutationsRef: MutableRefObject<Record<string, PendingTaskMutation>>;
  taskRefreshRequestRef: MutableRefObject<number>;
  setConnectionStatus: (next: string) => void;
  setPlatformHealth: (next: PlatformHealth | null) => void;
  setAuthConfig: (next: AuthConfig | null) => void;
  setAuthStatus: (next: string) => void;
  setProjects: (next: Project[]) => void;
  setSelectedProjectId: (next: string) => void;
  setTasks: (next: Task[]) => void;
  setPendingTaskMutations: (next: Record<string, PendingTaskMutation> | ((current: Record<string, PendingTaskMutation>) => Record<string, PendingTaskMutation>)) => void;
  setTaskSyncState: (next: TaskSyncState | ((current: TaskSyncState) => TaskSyncState)) => void;
  setSelectedTaskId: (next: string) => void;
  setApprovals: (next: Approval[]) => void;
  setTools: (next: ToolLink[]) => void;
  setUsage: (next: UsageOverview | null | ((current: UsageOverview | null) => UsageOverview | null)) => void;
  setUsageSummary: (next: string) => void;
  setWatchdogOverview: (next: WatchdogOverview | null) => void;
  summarizeError: (error: unknown) => string;
};

export function createDashboardRefreshActions(input: DashboardRefreshActionsInput) {
  const {
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
  } = input;

  function applyUsageOverview(raw: unknown) {
    const normalized = normalizeUsageOverview(raw);
    setUsage(normalized);
    setUsageSummary(buildUsageSummary(normalized, locale));
  }

  function normalizeTaskSyncTrigger(trigger?: TaskSyncTrigger): TaskSyncTrigger {
    return trigger === "auto" ? "auto" : "manual";
  }

  async function refreshHealth() {
    try {
      const [payload, platform] = await Promise.all([
        api<{ serverName: string; host: string }>("/api/health"),
        api<{ health: PlatformHealth }>("/api/platform-health"),
      ]);
      setConnectionStatus(
        locale === "zh-CN"
          ? `已连接 ${payload.serverName} @ ${payload.host}`
          : `Connected to ${payload.serverName} @ ${payload.host}`,
      );
      setPlatformHealth(normalizePlatformHealth(platform.health));
    } catch (error) {
      setConnectionStatus(summarizeError(error));
      setPlatformHealth(null);
    }
  }

  async function refreshAuth() {
    try {
      const payload = await api<AuthConfig>("/api/auth/config");
      setAuthConfig(payload);
      if (!payload.enabled) {
        setAuthStatus(copy.authDisabled);
      } else if (payload.user) {
        const username = payload.user.name || payload.user.login;
        setAuthStatus(locale === "zh-CN" ? `当前用户：${username}` : `Signed in as ${username}`);
      } else {
        setAuthStatus(copy.authRequired);
      }
    } catch (error) {
      setAuthStatus(summarizeError(error));
    }
  }

  async function refreshProjects() {
    try {
      const payload = await api<{ projects: Project[] }>("/api/projects");
      setProjects(payload.projects);

      if (!payload.projects.length) {
        setSelectedProjectId("");
        return;
      }

      const currentProjectId = selectedProjectIdRef.current;
      const nextProjectId = payload.projects.some((project) => project.id === currentProjectId)
        ? currentProjectId
        : payload.projects[0].id;

      if (nextProjectId !== currentProjectId) {
        setSelectedProjectId(nextProjectId);
      }
    } catch {
      setProjects([]);
    }
  }

  async function refreshTasks(options?: { trigger?: TaskSyncTrigger }) {
    const requestId = ++taskRefreshRequestRef.current;
    const trigger = normalizeTaskSyncTrigger(options?.trigger);
    setTaskSyncState({ inFlight: true, trigger });

    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      const normalizedTasks = payload.tasks.map((task) => normalizeApiTask(task, locale)).filter((task) => !task.isInternal);
      if (requestId !== taskRefreshRequestRef.current) {
        return;
      }
      const nextPendingTaskMutations = reconcilePendingTaskMutations(normalizedTasks, pendingTaskMutationsRef.current);
      setTasks(normalizedTasks);
      setPendingTaskMutations(nextPendingTaskMutations);
      setTaskSyncState({ inFlight: false });

      const visibleTaskIds = new Set([
        ...normalizedTasks.map((task) => task.id),
        ...Object.values(nextPendingTaskMutations)
          .filter((mutation) => mutation.placeholderTask)
          .map((mutation) => mutation.taskId),
      ]);
      if (!visibleTaskIds.size) {
        setSelectedTaskId("");
        return;
      }

      const currentTaskId = selectedTaskIdRef.current;
      const nextTaskId = currentTaskId && visibleTaskIds.has(currentTaskId)
        ? currentTaskId
        : normalizedTasks[0]?.id
          || Object.values(nextPendingTaskMutations).find((mutation) => mutation.placeholderTask)?.taskId
          || "";

      if (!currentTaskId) return;
      if (nextTaskId !== currentTaskId) {
        setSelectedTaskId(nextTaskId);
      }
    } catch {
      if (requestId !== taskRefreshRequestRef.current) {
        return;
      }
      setTasks([]);
      setTaskSyncState((current) => ({ ...current, inFlight: false }));
    }
  }

  async function refreshApprovals() {
    try {
      const payload = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(
        payload.approvals
          .map((approval) => ({
            ...approval,
            task: {
              ...normalizeApiTask(approval.task, locale),
              pendingAction: null,
            },
          }))
          .filter((approval) => taskNeedsUserAttention(approval.task)),
      );
    } catch {
      setApprovals([]);
    }
  }

  async function refreshTools() {
    try {
      const payload = await api<{
        tools: Array<{
          id: string;
          name: string;
          route: string;
          description: string;
          repository?: string;
          deploymentStatus?: string;
          deploymentError?: string;
          deploymentProvider?: string;
        }>;
      }>("/api/tools");
      setTools(payload.tools);
    } catch {
      setTools([]);
    }
  }

  async function refreshUsage(options?: { manual?: boolean }) {
    try {
      const path = options?.manual ? `/api/usage?refresh=1&t=${Date.now()}` : "/api/usage";
      const payload = await api<{ overview: UsageOverview }>(path, options?.manual ? { cache: "no-store" } : undefined);
      applyUsageOverview(payload.overview);
    } catch (error) {
      setUsage(null);
      setUsageSummary(
        locale === "zh-CN"
          ? `无法获取用量概览：${summarizeError(error)}`
          : `Unable to load usage overview: ${summarizeError(error)}`,
      );
    }
  }

  async function refreshWatchdog() {
    try {
      const payload = await api<{ watchdog: WatchdogOverview | null }>("/api/watchdog");
      setWatchdogOverview(normalizeWatchdogOverview(payload.watchdog));
    } catch {
      setWatchdogOverview(null);
    }
  }

  async function refreshAll(options?: { trigger?: TaskSyncTrigger }) {
    await Promise.all([
      refreshHealth(),
      refreshAuth(),
      refreshProjects(),
      refreshTasks(options),
      refreshApprovals(),
      refreshTools(),
      refreshUsage(),
      refreshWatchdog(),
    ]);
  }

  return {
    refreshAll,
    refreshHealth,
    refreshAuth,
    refreshProjects,
    refreshTasks,
    refreshApprovals,
    refreshTools,
    refreshUsage,
    refreshWatchdog,
  };
}

export function normalizeApiTask(task: Partial<Task>, locale: Locale): Task {
  const legacyTask = task as Partial<Task> & { baseModel?: string };
  const normalizedTask: Task = {
    id: String(task.id || "").trim(),
    createdAt: String(task.createdAt || "").trim() || undefined,
    updatedAt: String(task.updatedAt || "").trim() || undefined,
    rawStatus: String(task.rawStatus || task.status || "").trim() || undefined,
    requirementId: String(task.requirementId || "").trim() || undefined,
    attemptNumber: typeof task.attemptNumber === "number" ? task.attemptNumber : undefined,
    projectId: String(task.projectId || "").trim(),
    projectName: String(task.projectName || task.projectId || "").trim(),
    requestedProject: task.requestedProject || null,
    type: String(task.type || "").trim(),
    title: String(task.title || "").trim(),
    description: String(task.description || "").trim(),
    status: getTaskDisplayStatus(task as Task),
    requirementStatus: task.requirementStatus,
    summary: String(task.summary || "").trim(),
    rawWorkerSummary: String(task.rawWorkerSummary || task.summary || "").trim(),
    userSummary: String(task.userSummary || task.summary || "").trim(),
    userAction: task.userAction || null,
    pendingReason: task.pendingReason || undefined,
    pendingReasonLabel: task.pendingReasonLabel || undefined,
    pendingReasonDetail: task.pendingReasonDetail || task.openFailureReason || undefined,
    canStartExecution: Boolean(task.allowedActions?.includes("start")),
    pendingAction: task.pendingAction || null,
    lastStatusCommentAt: String(task.lastStatusCommentAt || "").trim() || undefined,
    planPreview: String(task.planPreview || "").trim(),
    planForm: normalizePlanForm(task.planForm) || buildPlanFormFromPreview(String(task.planPreview || ""), locale),
    planDraftPending: Boolean(task.planDraftPending),
    executionMode: String(task.executionMode || "").trim() || undefined,
    projectExecution: normalizeProjectExecution(task.projectExecution),
    executionDecisionGate: normalizeExecutionDecisionGate(task.executionDecisionGate),
    resumeEligible: Boolean(task.resumeEligible),
    failureType: String(task.failureType || "").trim() || undefined,
    failurePhase: String(task.failurePhase || "").trim() || undefined,
    isInternal: Boolean(task.isInternal),
    projectStepMeta: task.projectStepMeta || null,
    workspacePath: String(task.workspacePath || "").trim(),
    branchName: String(task.branchName || "").trim(),
    model: String(task.model || "").trim() || undefined,
    requestedModel: String(task.requestedModel || legacyTask.baseModel || "").trim() || undefined,
    reasoningEffort: task.reasoningEffort,
    planMode: Boolean(task.planMode),
    fastMode: Boolean(task.fastMode || task.speedTier === "fast"),
    speedTier: String(task.speedTier || "").trim() || undefined,
    publishStatus: String(task.publishStatus || "").trim() || undefined,
    publishMethod: String(task.publishMethod || "").trim() || undefined,
    publishVerified: Boolean(task.publishVerified),
    healthFlags: Array.isArray(task.healthFlags) ? task.healthFlags : [],
    openFailureReason: String(task.openFailureReason || "").trim() || undefined,
    acceptanceCompleted: typeof task.acceptanceCompleted === "number" ? task.acceptanceCompleted : undefined,
    acceptanceTotal: typeof task.acceptanceTotal === "number" ? task.acceptanceTotal : undefined,
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : undefined,
    verificationResults: Array.isArray(task.verificationResults) ? task.verificationResults : undefined,
    logs: (task.logs || []).map((entry) => ({
      ...entry,
      audience: entry.audience === "operator" ? ("operator" as const) : ("raw" as const),
    })),
    children: Array.isArray(task.children) ? task.children : [],
    queuePosition: typeof task.queuePosition === "number" ? task.queuePosition : undefined,
    queueEnteredAt: task.queueEnteredAt || task.queueState?.requestedAt || undefined,
    queueName: task.queueName || undefined,
    queueBlockedByTaskId: task.queueBlockedByTaskId || undefined,
    queueBlockedByTaskTitle: task.queueBlockedByTaskTitle || undefined,
    issueNumber: typeof task.issueNumber === "number" ? task.issueNumber : undefined,
    issueUrl: String(task.issueUrl || "").trim() || undefined,
    allowedActions: Array.isArray(task.allowedActions) ? task.allowedActions : [],
    queueState: task.queueState || null,
    nodeStatusSummary: task.nodeStatusSummary || null,
    latestProgress: task.latestProgress || null,
    latestFailure: task.latestFailure || null,
  };
  if (normalizedTask.status === "waiting") {
    normalizedTask.pendingReason = getTaskPendingReason(normalizedTask) || undefined;
    if (!normalizedTask.pendingReasonLabel && normalizedTask.pendingReason === "manual_intervention") {
      const gateRecovery = normalizedTask.failureType === "verification_gate_failed"
        && /task_completion gate failed/i.test(String(normalizedTask.openFailureReason || ""));
      normalizedTask.pendingReasonLabel = gateRecovery
        ? (locale === "zh-CN" ? "系统修复中" : "System recovery")
        : (locale === "zh-CN" ? "人工介入" : "Manual intervention");
    }
  } else {
    normalizedTask.pendingReason = normalizedTask.pendingReason || undefined;
  }
  return normalizedTask;
}
