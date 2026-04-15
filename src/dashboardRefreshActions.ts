import type { MutableRefObject } from "react";

import {
  DEFAULT_API_BASE,
  GITHUB_CLIENT_ID,
  GITHUB_TASK_REPO,
  HAS_MIXED_CONTENT_LOCAL_API,
  REMOTE_PROJECT_CATALOG,
  type DashboardCopy,
} from "./dashboardConstants";
import { buildLogsFromComments, normalizeExecutionDecisionGate, normalizePlanForm, normalizeProjectExecution, parseStatusFromComments, type IssueComment } from "./dashboardGithub";
import { loadGithubStatusSnapshot } from "./dashboardClient";
import { applyPendingMutationsToTasks, reconcilePendingTaskMutations } from "./dashboardPendingMutations";
import {
  buildGithubDirectPlanPreview,
  buildGithubDirectUserAction,
  buildPlanFormFromPreview,
  getProjectDisplayName,
  parseIssueBody,
  parseEmbeddedStatusPayload,
} from "./dashboardProjectUtils";
import {
  buildGithubDirectPlatformHealth,
  buildGithubDirectUsageFallback,
  buildUsageSummary,
  normalizePlatformHealth,
  normalizeUsageOverview,
} from "./dashboardUsageUtils";
import type {
  Approval,
  AuthConfig,
  Locale,
  PlatformHealth,
  Project,
  Requirement,
  RuntimeMode,
  Task,
  ToolLink,
  UsageOverview,
} from "./dashboardTypes";
import type { PendingTaskMutation, TaskSyncState } from "./dashboardControlTypes";

type DashboardRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type DashboardRefreshActionsInput = {
  locale: Locale;
  runtimeMode: RuntimeMode;
  copy: DashboardCopy;
  githubToken: string;
  visibleTasks: Task[];
  visibleRequirements: Requirement[];
  api: DashboardRequest;
  githubRequest: DashboardRequest;
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
  summarizeError: (error: unknown) => string;
};

export function createDashboardRefreshActions(input: DashboardRefreshActionsInput) {
  const {
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
  } = input;

  function applyUsageOverview(raw: unknown) {
    const normalized = normalizeUsageOverview(raw);
    setUsage(normalized);
    setUsageSummary(buildUsageSummary(normalized, locale));
  }

  async function refreshHealth() {
    if (runtimeMode === "github-direct") {
      setConnectionStatus(
        locale === "zh-CN"
          ? `GitHub Issue 队列模式 · ${GITHUB_TASK_REPO}`
          : `GitHub issue queue mode · ${GITHUB_TASK_REPO}`,
      );
      setPlatformHealth(buildGithubDirectPlatformHealth({
        githubTaskRepo: GITHUB_TASK_REPO,
        githubToken,
        locale,
        visibleTasks,
        visibleRequirements,
      }));
      return;
    }
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
    if (runtimeMode === "github-direct") {
      if (!GITHUB_CLIENT_ID) {
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: false,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: null,
        });
        setAuthStatus(locale === "zh-CN" ? "请连接可写入 issue 的 GitHub Token。" : "Connect a GitHub token with issue access.");
        return;
      }

      if (!githubToken) {
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: true,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: null,
        });
        setAuthStatus(locale === "zh-CN" ? "请连接 GitHub Token 后直接提交 Issue 任务。" : "Connect a GitHub token to create and control issue tasks.");
        return;
      }

      try {
        const user = await githubRequest<{ login: string; name: string }>("/user");
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: true,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: {
            login: user.login,
            name: user.name || user.login,
          },
        });
        setAuthStatus(locale === "zh-CN" ? `当前用户：${user.name || user.login}` : `Signed in as ${user.name || user.login}`);
      } catch (error) {
        localStorage.removeItem("codex.githubAccessToken");
        setAuthStatus(summarizeError(error));
      }
      return;
    }

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
    if (runtimeMode === "github-direct") {
      try {
        const snapshot = await loadGithubStatusSnapshot<{
          projects?: Array<{
            id?: string;
            name?: string;
            description?: string;
            repository?: string;
            toolRoute?: string;
            toolUrl?: string;
            type?: string;
            deploymentProvider?: string;
            deploymentStatus?: string;
            deploymentError?: string;
          }>;
        }>({
          githubTaskRepo: GITHUB_TASK_REPO,
          githubToken,
          parsePayload: parseEmbeddedStatusPayload,
        });
        const snapshotProjects = Array.isArray(snapshot?.projects)
          ? snapshot.projects
            .map((project) => ({
              id: String(project.id || "").trim(),
              name: String(project.name || "").trim(),
              description: String(project.description || "").trim(),
              repository: String(project.repository || "").trim(),
              toolRoute: String(project.toolRoute || "").trim(),
              toolUrl: String(project.toolUrl || "").trim() || undefined,
              type: String(project.type || "").trim() || undefined,
              deploymentProvider: String(project.deploymentProvider || "").trim() || undefined,
              deploymentStatus: String(project.deploymentStatus || "").trim() || undefined,
              deploymentError: String(project.deploymentError || "").trim() || undefined,
              taskStats: {
                total: 0,
                running: 0,
                failed: 0,
                waitingUser: 0,
                completed: 0,
              },
            }))
            .filter((project) => project.id)
          : [];
        setProjects(snapshotProjects);
      } catch {
        setProjects([]);
      }
      return;
    }
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

  async function refreshTasks() {
    const requestId = ++taskRefreshRequestRef.current;
    setTaskSyncState((current) => ({ ...current, inFlight: true }));
    if (runtimeMode === "github-direct") {
      if (!githubToken) {
        if (requestId !== taskRefreshRequestRef.current) {
          return;
        }
        setTasks([]);
        setPendingTaskMutations({});
        setTaskSyncState({ inFlight: false, lastSyncedAt: new Date().toISOString() });
        return;
      }

      try {
        const [owner, repo] = GITHUB_TASK_REPO.split("/");
        const issues = await githubRequest<Array<{
          number: number;
          title: string;
          body: string;
          state: string;
          html_url: string;
          updated_at: string;
          labels: Array<{ name: string }>;
          pull_request?: unknown;
        }>>(`/repos/${owner}/${repo}/issues?state=all&labels=codex-task&per_page=100&sort=updated&direction=desc`);

        const taskList = (
          await Promise.all(
            issues
              .filter((issue) => !issue.pull_request)
              .map(async (issue) => {
                const parsed = parseIssueBody(issue.body || "");
                const comments = await githubRequest<IssueComment[]>(
                  `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100&sort=created&direction=asc`,
                );
                const statusMeta = parseStatusFromComments(comments, issue.state === "closed");
                const logs = buildLogsFromComments(comments);
                const projectId = parsed.projectId || "dashboard-ui";
                const title = parsed.title || issue.title;
                const description = parsed.description || issue.body || "";
                const planPreview =
                  statusMeta.planPreview ||
                  buildGithubDirectPlanPreview({
                    type: parsed.type,
                    title,
                    description,
                    requestedProject: parsed.requestedProject,
                  });
                const planForm = statusMeta.planForm || buildPlanFormFromPreview(planPreview, locale);
                const userAction = buildGithubDirectUserAction({
                  status: statusMeta.status,
                  type: parsed.type,
                  title,
                  description,
                  planPreview,
                  userAction: statusMeta.userAction,
                });
                return {
                  id: statusMeta.taskId || `issue-${issue.number}`,
                  updatedAt: issue.updated_at,
                  issueNumber: issue.number,
                  issueUrl: issue.html_url,
                  projectId,
                  projectName: getProjectDisplayName(projectId, locale, parsed.requestedProject?.name || ""),
                  requestedProject: parsed.requestedProject,
                  type: parsed.type,
                  title,
                  description,
                  model: parsed.model,
                  reasoningEffort: parsed.reasoningEffort,
                  status: statusMeta.status,
                  summary: statusMeta.summary,
                  userSummary: statusMeta.userSummary,
                  userAction,
                  lastStatusCommentAt: statusMeta.lastStatusCommentAt || undefined,
                  planPreview,
                  planForm,
                  planDraftPending: statusMeta.planDraftPending,
                  executionMode: statusMeta.executionMode || undefined,
                  projectExecution: statusMeta.projectExecution,
                  executionDecisionGate: statusMeta.executionDecisionGate,
                  resumeEligible: statusMeta.resumeEligible,
                  failureType: statusMeta.failureType || undefined,
                  failurePhase: statusMeta.failurePhase || undefined,
                  isInternal: statusMeta.internalOnly,
                  publishStatus: statusMeta.publishStatus || undefined,
                  openFailureReason: statusMeta.openFailureReason || undefined,
                  workspacePath: "",
                  branchName: "",
                  logs,
                  children: [],
                } satisfies Task;
              }),
          )
        )
          .filter((task) => !task.isInternal)
          .sort((left, right) => (right.issueNumber || 0) - (left.issueNumber || 0));

        if (requestId !== taskRefreshRequestRef.current) {
          return;
        }
        const nextPendingTaskMutations = reconcilePendingTaskMutations(taskList, pendingTaskMutationsRef.current);
        setTasks(taskList);
        setPendingTaskMutations(nextPendingTaskMutations);
        setUsage((current) => {
          const hasRuntimeSnapshot = Boolean(
            current?.rateLimits?.primary ||
            current?.rateLimits?.secondary ||
            current?.statusCollectedAt,
          );
          return hasRuntimeSnapshot ? current : buildGithubDirectUsageFallback(applyPendingMutationsToTasks(taskList, nextPendingTaskMutations, locale), locale);
        });
        setTaskSyncState({ inFlight: false, lastSyncedAt: new Date().toISOString() });

        const visibleTaskIds = new Set([
          ...taskList.map((task) => task.id),
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
          : taskList[0]?.id
            || Object.values(nextPendingTaskMutations).find((mutation) => mutation.placeholderTask)?.taskId
            || "";
        if (currentTaskId && nextTaskId !== currentTaskId) {
          setSelectedTaskId(nextTaskId);
        }
      } catch {
        if (requestId !== taskRefreshRequestRef.current) {
          return;
        }
        setTasks([]);
        setTaskSyncState((current) => ({ ...current, inFlight: false }));
      }
      return;
    }

    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      const normalizedTasks = payload.tasks.map((task) => ({
        ...task,
        logs: (task.logs || []).map((entry) => ({
          ...entry,
          audience: entry.audience === "operator" ? ("operator" as const) : ("raw" as const),
        })),
        planForm: normalizePlanForm(task.planForm) || buildPlanFormFromPreview(task.planPreview, locale),
        planDraftPending: Boolean(task.planDraftPending),
        projectExecution: normalizeProjectExecution(task.projectExecution),
        executionDecisionGate: normalizeExecutionDecisionGate(task.executionDecisionGate),
        resumeEligible: Boolean(task.resumeEligible),
        isInternal: Boolean(task.isInternal),
      })).filter((task) => !task.isInternal);
      if (requestId !== taskRefreshRequestRef.current) {
        return;
      }
      const nextPendingTaskMutations = reconcilePendingTaskMutations(normalizedTasks, pendingTaskMutationsRef.current);
      setTasks(normalizedTasks);
      setPendingTaskMutations(nextPendingTaskMutations);
      setTaskSyncState({ inFlight: false, lastSyncedAt: new Date().toISOString() });

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
    if (runtimeMode === "github-direct") {
      return;
    }
    try {
      const payload = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(
        payload.approvals
          .map((approval) => ({
            ...approval,
            task: {
              ...approval.task,
              logs: (approval.task.logs || []).map((entry) => ({
                ...entry,
                audience: entry.audience === "operator" ? ("operator" as const) : ("raw" as const),
              })),
              planForm: normalizePlanForm(approval.task.planForm) || buildPlanFormFromPreview(approval.task.planPreview, locale),
              planDraftPending: Boolean(approval.task.planDraftPending),
              pendingAction: null,
            },
          }))
          .filter((approval) => approval.task.status === "waiting_user"),
      );
    } catch {
      setApprovals([]);
    }
  }

  async function refreshTools() {
    const fallbackTools = REMOTE_PROJECT_CATALOG
      .filter((project) => project.type === "ui")
      .map((project) => ({
        id: project.id,
        name: getProjectDisplayName(project.id, locale, project.name),
        route: project.toolUrl || project.repository,
        description: project.description,
        repository: project.repository,
        deploymentStatus: project.deploymentStatus || "",
      }));

    if (runtimeMode === "github-direct") {
      try {
        const snapshot = await loadGithubStatusSnapshot<{
          tools?: Array<{
            id?: string;
            name?: string;
            route?: string;
            description?: string;
            repository?: string;
            deploymentStatus?: string;
            deploymentError?: string;
            deploymentProvider?: string;
          }>;
        }>({
          githubTaskRepo: GITHUB_TASK_REPO,
          githubToken,
          parsePayload: parseEmbeddedStatusPayload,
        });
        const tools = Array.isArray(snapshot?.tools)
          ? snapshot.tools
            .map((tool) => ({
              id: String(tool.id || "").trim(),
              name: getProjectDisplayName(String(tool.id || "").trim(), locale, String(tool.name || "").trim()),
              route: String(tool.route || "").trim(),
              description: String(tool.description || "").trim(),
              repository: String(tool.repository || "").trim() || undefined,
              deploymentStatus: String(tool.deploymentStatus || "").trim() || undefined,
              deploymentError: String(tool.deploymentError || "").trim() || undefined,
              deploymentProvider: String(tool.deploymentProvider || "").trim() || undefined,
            }))
            .filter((tool) => tool.id && tool.route)
          : [];
        setTools(tools.length ? tools : fallbackTools);
      } catch {
        setTools(fallbackTools);
      }
      return;
    }
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

  async function refreshUsage() {
    if (runtimeMode === "github-direct") {
      try {
        const snapshot = await loadGithubStatusSnapshot({
          githubTaskRepo: GITHUB_TASK_REPO,
          githubToken,
          parsePayload: parseEmbeddedStatusPayload,
        });
        if (snapshot?.usage) {
          applyUsageOverview(snapshot.usage);
          if (snapshot.health) {
            setPlatformHealth(normalizePlatformHealth(snapshot.health));
          }
          return;
        }
      } catch (error) {
        if (!HAS_MIXED_CONTENT_LOCAL_API) {
          setUsage(buildGithubDirectUsageFallback(visibleTasks, locale));
          setUsageSummary(
            locale === "zh-CN"
              ? `无法从 GitHub 状态快照读取本机用量，已回退到任务统计：${summarizeError(error)}`
              : `Unable to read local usage from the GitHub status snapshot. Falling back to task activity: ${summarizeError(error)}`,
          );
          return;
        }
        if (window.location.protocol === "https:" && /^http:\/\//i.test(DEFAULT_API_BASE)) {
          setUsage(buildGithubDirectUsageFallback(visibleTasks, locale));
          setUsageSummary(
            locale === "zh-CN"
              ? `当前页面通过 HTTPS 打开，但后端地址是 ${DEFAULT_API_BASE}。浏览器会拦截 GitHub Pages 到本机 HTTP API 的请求；页面现在会优先读取 GitHub 状态快照，如果该快照还未同步出来，则只能先显示任务统计。`
              : `This page is served over HTTPS, but the backend is configured as ${DEFAULT_API_BASE}. Browsers block GitHub Pages from calling a local HTTP API; the dashboard now prefers a GitHub-backed status snapshot, and falls back to task activity until that snapshot is available.`,
          );
          return;
        }
      }
    }
    try {
      const payload = await api<{ overview: UsageOverview }>("/api/usage");
      applyUsageOverview(payload.overview);
    } catch (error) {
      if (runtimeMode === "github-direct") {
        setUsage(buildGithubDirectUsageFallback(visibleTasks, locale));
      } else {
        setUsage(null);
      }
      setUsageSummary(
        runtimeMode === "github-direct"
          ? locale === "zh-CN"
            ? `无法读取本机用量快照，已回退到 GitHub Issue 任务统计：${summarizeError(error)}`
            : `Unable to read the local usage snapshot. Falling back to GitHub issue activity: ${summarizeError(error)}`
          : locale === "zh-CN"
            ? `无法获取用量概览：${summarizeError(error)}`
            : `Unable to load usage overview: ${summarizeError(error)}`,
      );
    }
  }

  async function refreshAll() {
    if (runtimeMode === "github-direct") {
      await Promise.all([refreshHealth(), refreshAuth(), refreshProjects(), refreshTasks(), refreshTools(), refreshUsage()]);
      return;
    }
    await Promise.all([refreshHealth(), refreshAuth(), refreshProjects(), refreshTasks(), refreshApprovals(), refreshTools(), refreshUsage()]);
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
  };
}
