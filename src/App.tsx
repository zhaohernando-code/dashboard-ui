import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TaskStatus =
  | "pending"
  | "running"
  | "waiting_user"
  | "failed"
  | "completed"
  | "stopped";

type Project = {
  id: string;
  name: string;
  description: string;
  repository: string;
  toolRoute: string;
  taskStats: {
    total: number;
    running: number;
    failed: number;
    waitingUser: number;
    completed: number;
  };
};

type TaskChild = {
  id: string;
  title: string;
  status: TaskStatus;
};

type TaskLog = {
  timestamp: string;
  message: string;
};

type Task = {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  title: string;
  description: string;
  status: TaskStatus;
  summary: string;
  planPreview: string;
  workspacePath: string;
  branchName: string;
  logs: TaskLog[];
  children: TaskChild[];
  issueNumber?: number;
  issueUrl?: string;
};

type Approval = {
  id: string;
  reason: string;
  task: Task;
};

type UsageOverview = {
  totalTasks: number;
  activeTasks: number;
  pendingApprovals: number;
  completedTasks: number;
  failedTasks: number;
  estimatedTokens: number;
  totalRuns: number;
  lastRunAt: string;
};

type AuthConfig = {
  enabled: boolean;
  mode: string;
  provider: string;
  hasClientId: boolean;
  repoAutomationEnabled: boolean;
  taskBackend?: string;
  githubTaskRepo?: string;
  user: null | {
    login: string;
    name: string;
  };
};

type IssueTask = {
  number: number;
  url: string;
  repo: string;
};

type DeviceLoginSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSec: number;
  status: string;
  error: string;
};

type Locale = "zh-CN" | "en-US";
type CopyState = "idle" | "copied";
type ThemeMode = "light" | "dark";
type WorkspaceLevel = "projects" | "tasks" | "detail";
type RuntimeMode = "local-api" | "github-direct";
type CreateDialogMode = "project" | "task" | "composite_task";

const DEFAULT_API_BASE = (import.meta.env.VITE_DEFAULT_API_BASE as string | undefined)?.trim() || "http://localhost:8787";
const GITHUB_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() || "";
const GITHUB_TASK_REPO = (import.meta.env.VITE_GITHUB_TASK_REPO as string | undefined)?.trim() || "zhaohernando-code/dashboard-ui";
const GITHUB_SCOPES = (import.meta.env.VITE_GITHUB_OAUTH_SCOPES as string | undefined)?.trim() || "read:user repo";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const AUTO_ROUTE_PROJECT_ID = "__auto_route__";
const REMOTE_PROJECT_CATALOG = [
  {
    id: "dashboard-ui",
    name: "dashboard-ui",
    description: "GitHub Pages dashboard for project and issue-driven task dispatch.",
    repository: "https://github.com/zhaohernando-code/dashboard-ui",
    toolRoute: "/tools/dashboard-ui",
  },
  {
    id: "local-control-server",
    name: "local-control-server",
    description: "Local poller/executor that consumes GitHub issue tasks.",
    repository: "https://github.com/zhaohernando-code/local-control-server",
    toolRoute: "/tools/local-control-server",
  },
] satisfies Array<Pick<Project, "id" | "name" | "description" | "repository" | "toolRoute">>;

const tabs = [
  { id: "quest-center", label: { "zh-CN": "工作台", "en-US": "Workspace" } },
  { id: "tools", label: { "zh-CN": "工具入口", "en-US": "Tools" } },
  { id: "usage", label: { "zh-CN": "用量概览", "en-US": "Usage" } },
] as const;

const statusLabel: Record<TaskStatus, Record<Locale, string>> = {
  pending: { "zh-CN": "等待中", "en-US": "Pending" },
  running: { "zh-CN": "运行中", "en-US": "Running" },
  waiting_user: { "zh-CN": "待你确认", "en-US": "Awaiting Approval" },
  failed: { "zh-CN": "失败", "en-US": "Failed" },
  completed: { "zh-CN": "完成", "en-US": "Completed" },
  stopped: { "zh-CN": "已停止", "en-US": "Stopped" },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}


function parseTaskType(value: string) {
  const raw = String(value || "task").trim().toLowerCase();
  if (raw === "project_create" || raw === "composite_task" || raw === "task") {
    return raw;
  }
  return "task";
}

function parseIssueBody(body: string) {
  const embedded = body.match(/<!--\s*codex-task-payload\s*([\s\S]*?)\s*-->/i);
  if (embedded) {
    try {
      const payload = JSON.parse(embedded[1]);
      return {
        projectId: String(payload.projectId || "dashboard-ui").trim() || "dashboard-ui",
        type: parseTaskType(payload.type),
        title: String(payload.title || "Untitled task").trim(),
        description: String(payload.description || "").trim(),
      };
    } catch {
      // Fall through to plain parsing.
    }
  }

  const meta: Record<string, string> = {};
  for (const line of String(body || "").split("\n").slice(0, 12)) {
    const match = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)\s*$/);
    if (match) meta[match[1].toLowerCase()] = match[2].trim();
  }
  return {
    projectId: meta.project || meta.projectid || "dashboard-ui",
    type: parseTaskType(meta.type || "task"),
    title: "",
    description: String(body || "").replace(/<!--[\s\S]*?-->/g, "").trim(),
  };
}

function parseStatusFromComments(comments: Array<{ body: string }>, fallbackClosed: boolean): { status: TaskStatus; taskId: string; summary: string } {
  let status: TaskStatus = fallbackClosed ? "completed" : "pending";
  let taskId = "";
  let summary = "";

  for (const comment of comments) {
    const body = String(comment.body || "");
    const imported = body.match(/Task imported as\s+`([^`]+)`/i);
    if (imported) {
      taskId = imported[1];
    }
    const statusMatch = body.match(/Task\s+`([^`]+)`\s+status changed to\s+`([^`]+)`/i);
    if (statusMatch) {
      taskId = statusMatch[1];
      const next = statusMatch[2].toLowerCase() as TaskStatus;
      if (["pending", "running", "waiting_user", "failed", "completed", "stopped"].includes(next)) {
        status = next;
      }
      const summaryMatch = body.match(/Summary:\s*([\s\S]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
    }
  }

  return { status, taskId, summary };
}

function buildRemoteProjects(tasks: Task[]) {
  const projectMap = new Map(
    REMOTE_PROJECT_CATALOG.map((project) => [
      project.id,
      {
        ...project,
        taskStats: {
          total: 0,
          running: 0,
          failed: 0,
          waitingUser: 0,
          completed: 0,
        },
      },
    ]),
  );

  for (const task of tasks) {
    if (!projectMap.has(task.projectId)) {
      projectMap.set(task.projectId, {
        id: task.projectId,
        name: task.projectId === AUTO_ROUTE_PROJECT_ID ? "AI-routed" : task.projectId,
        description:
          task.projectId === AUTO_ROUTE_PROJECT_ID
            ? "Composite or cross-project work waiting for AI routing."
            : "",
        repository: "",
        toolRoute: `/tools/${task.projectId}`,
        taskStats: { total: 0, running: 0, failed: 0, waitingUser: 0, completed: 0 },
      });
    }
    const project = projectMap.get(task.projectId)!;
    project.taskStats.total += 1;
    if (task.status === "running") project.taskStats.running += 1;
    if (task.status === "failed") project.taskStats.failed += 1;
    if (task.status === "waiting_user") project.taskStats.waitingUser += 1;
    if (task.status === "completed") project.taskStats.completed += 1;
  }

  return Array.from(projectMap.values());
}

function isCompositeTask(type: string) {
  return parseTaskType(type) === "composite_task";
}

function getTaskProjectId(type: string, rawProjectId: string) {
  const normalizedProjectId = String(rawProjectId || "").trim();
  if (isCompositeTask(type)) {
    return AUTO_ROUTE_PROJECT_ID;
  }
  return normalizedProjectId || "dashboard-ui";
}

function getProjectDisplayName(projectId: string, locale: Locale) {
  if (projectId === AUTO_ROUTE_PROJECT_ID) {
    return locale === "zh-CN" ? "AI 待判定项目" : "AI-routed";
  }
  return projectId;
}

export default function App() {
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
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<Array<{ id: string; name: string; route: string; description: string }>>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [workspaceLevel, setWorkspaceLevel] = useState<WorkspaceLevel>("projects");
  const [createDialogMode, setCreateDialogMode] = useState<CreateDialogMode | null>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [deviceLogin, setDeviceLogin] = useState<DeviceLoginSession | null>(null);
  const [notice, setNotice] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pollTokenRef = useRef(0);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedTaskIdRef = useRef(selectedTaskId);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [selectedProjectId, tasks],
  );

  const t = useMemo(
    () =>
      ({
        title: locale === "zh-CN" ? "Codex 控制中台" : "Codex Control Center",
        subtitle:
          locale === "zh-CN"
            ? "项目、任务、审批与运行数据统一管理"
            : "Unified workspace for projects, tasks, approvals and usage",
        localApi: locale === "zh-CN" ? "本地服务地址：" : "Local API:",
        authDisabled:
          locale === "zh-CN"
            ? "当前服务未启用登录，可直接使用看板。"
            : "Authentication disabled by server. Dashboard is open.",
        authRequired:
          locale === "zh-CN"
            ? "未登录也可进入看板，涉及仓库自动化的操作会受限。"
            : "You can browse without sign-in; repo automation requires authentication.",
        loginButton: locale === "zh-CN" ? "GitHub 登录" : "Sign in with GitHub",
        logoutButton: locale === "zh-CN" ? "退出登录" : "Sign out",
        refresh: locale === "zh-CN" ? "刷新" : "Refresh",
        taskDetails: locale === "zh-CN" ? "任务详情" : "Task details",
        pendingApprovals: locale === "zh-CN" ? "待处理审批" : "Pending approvals",
        noTask: locale === "zh-CN" ? "请选择任务查看详情" : "Select one task to inspect",
      }) satisfies Record<string, string>,
    [locale],
  );

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
    setIsMobileNavOpen(false);
  }, [activeTab, locale, theme]);

  useEffect(() => {
    void refreshAll();
    const interval = window.setInterval(() => {
      void refreshTasks();
      void refreshApprovals();
      void refreshUsage();
      void refreshAuth();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [sessionToken, githubToken]);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId("");
      setSelectedTaskId("");
      setWorkspaceLevel("projects");
      return;
    }

    if (!selectedProjectId) return;

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      setWorkspaceLevel("projects");
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!tasks.length) {
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (!selectedTaskId) return;

    const nextTask = tasks.find((task) => task.id === selectedTaskId);
    if (!nextTask) {
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (nextTask.projectId !== selectedProjectId) {
      setSelectedProjectId(nextTask.projectId);
    }
  }, [selectedProjectId, selectedTaskId, tasks, workspaceLevel]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${DEFAULT_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!githubToken) {
      throw new Error(locale === "zh-CN" ? "请先使用 GitHub 登录" : "Sign in with GitHub first");
    }
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message || `GitHub API failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  function summarizeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function setTransientNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4500);
  }

  async function refreshAll() {
    await Promise.all([refreshHealth(), refreshAuth(), refreshProjects(), refreshTasks(), refreshApprovals(), refreshTools(), refreshUsage()]);
  }

  async function refreshHealth() {
    if (runtimeMode === "github-direct") {
      setConnectionStatus(
        locale === "zh-CN"
          ? `GitHub Issue 队列模式 · ${GITHUB_TASK_REPO}`
          : `GitHub issue queue mode · ${GITHUB_TASK_REPO}`,
      );
      return;
    }
    try {
      const payload = await api<{ serverName: string; host: string }>("/api/health");
      setConnectionStatus(
        locale === "zh-CN"
          ? `已连接 ${payload.serverName} @ ${payload.host}`
          : `Connected to ${payload.serverName} @ ${payload.host}`,
      );
    } catch (error) {
      setConnectionStatus(summarizeError(error));
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
        setGithubToken("");
        setAuthStatus(summarizeError(error));
      }
      return;
    }
    try {
      const payload = await api<AuthConfig>("/api/auth/config");
      setAuthConfig(payload);
      if (!payload.enabled) {
        setAuthStatus(t.authDisabled);
      } else if (payload.user) {
        const username = payload.user.name || payload.user.login;
        setAuthStatus(locale === "zh-CN" ? `当前用户：${username}` : `Signed in as ${username}`);
      } else {
        setAuthStatus(t.authRequired);
      }
    } catch (error) {
      setAuthStatus(summarizeError(error));
    }
  }

  async function refreshProjects() {
    if (runtimeMode === "github-direct") {
      const nextProjects = buildRemoteProjects(tasks);
      setProjects(nextProjects);
      if (!nextProjects.length) {
        setSelectedProjectId("");
        return;
      }
      const currentProjectId = selectedProjectIdRef.current;
      const nextProjectId = nextProjects.some((project) => project.id === currentProjectId)
        ? currentProjectId
        : nextProjects[0].id;
      if (nextProjectId !== currentProjectId) {
        setSelectedProjectId(nextProjectId);
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
    if (runtimeMode === "github-direct") {
      if (!githubToken) {
        setTasks([]);
        setApprovals([]);
        setUsage(null);
        setProjects(buildRemoteProjects([]));
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
                const comments = await githubRequest<Array<{ body: string }>>(
                  `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100&sort=created&direction=asc`,
                );
                const statusMeta = parseStatusFromComments(comments, issue.state === "closed");
                const projectId = parsed.projectId || "dashboard-ui";
                return {
                  id: statusMeta.taskId || `issue-${issue.number}`,
                  issueNumber: issue.number,
                  issueUrl: issue.html_url,
                  projectId,
                  projectName: getProjectDisplayName(projectId, locale),
                  type: parsed.type,
                  title: parsed.title || issue.title,
                  description: parsed.description || issue.body || "",
                  status: statusMeta.status,
                  summary: statusMeta.summary,
                  planPreview: "",
                  workspacePath: "",
                  branchName: "",
                  logs: [],
                  children: [],
                } satisfies Task;
              }),
          )
        ).sort((left, right) => (right.issueNumber || 0) - (left.issueNumber || 0));

        setTasks(taskList);
        setProjects(buildRemoteProjects(taskList));
        setApprovals(
          taskList
            .filter((task) => task.status === "waiting_user")
            .map((task) => ({
              id: `approval-${task.issueNumber || task.id}`,
              reason: locale === "zh-CN" ? "请在 GitHub Pages 审批后继续执行" : "Approve in GitHub Pages to continue execution",
              task,
            })),
        );
        setUsage({
          totalTasks: taskList.length,
          activeTasks: taskList.filter((task) => task.status === "running").length,
          pendingApprovals: taskList.filter((task) => task.status === "waiting_user").length,
          completedTasks: taskList.filter((task) => task.status === "completed").length,
          failedTasks: taskList.filter((task) => task.status === "failed").length,
          estimatedTokens: 0,
          totalRuns: taskList.length,
          lastRunAt: issues[0]?.updated_at || "",
        });

        if (!taskList.length) {
          setSelectedTaskId("");
          return;
        }
        const currentTaskId = selectedTaskIdRef.current;
        const nextTaskId = taskList.some((task) => task.id === currentTaskId) ? currentTaskId : taskList[0].id;
        if (currentTaskId && nextTaskId !== currentTaskId) {
          setSelectedTaskId(nextTaskId);
        }
      } catch {
        setTasks([]);
        setApprovals([]);
      }
      return;
    }
    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      setTasks(payload.tasks);

      if (!payload.tasks.length) {
        setSelectedTaskId("");
        return;
      }

      const currentTaskId = selectedTaskIdRef.current;
      const nextTaskId = payload.tasks.some((task) => task.id === currentTaskId)
        ? currentTaskId
        : payload.tasks[0].id;

      if (!currentTaskId) return;
      if (nextTaskId !== currentTaskId) {
        setSelectedTaskId(nextTaskId);
      }
    } catch {
      setTasks([]);
    }
  }

  async function refreshApprovals() {
    if (runtimeMode === "github-direct") {
      return;
    }
    try {
      const payload = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(payload.approvals.filter((approval) => approval.task.status === "waiting_user"));
    } catch {
      setApprovals([]);
    }
  }

  async function refreshTools() {
    if (runtimeMode === "github-direct") {
      setTools(
        REMOTE_PROJECT_CATALOG.map((project) => ({
          id: project.id,
          name: getProjectDisplayName(project.id, locale),
          route: project.repository,
          description: project.description,
        })),
      );
      return;
    }
    try {
      const payload = await api<{ tools: Array<{ id: string; name: string; route: string; description: string }> }>("/api/tools");
      setTools(payload.tools);
    } catch {
      setTools([]);
    }
  }

  async function refreshUsage() {
    if (runtimeMode === "github-direct") {
      return;
    }
    try {
      const payload = await api<{ overview: UsageOverview }>("/api/usage");
      setUsage(payload.overview);
    } catch {
      setUsage(null);
    }
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") || "").trim();
      const description = String(form.get("description") || "").trim();
      const repository = String(form.get("repository") || "").trim();
      const visibility = String(form.get("visibility") || "private");
      const autoCreateRepo = form.get("autoCreateRepo") === "on";

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = {
          projectId: "dashboard-ui",
          type: "project_create",
          title: `Create project: ${name}`,
          description: description || `Create a new Codex-managed project named ${name}.`,
          requestedProject: {
            id: slugify(name),
            name,
            description,
            repository,
            visibility,
            autoCreateRepo,
          },
        };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            body: [
              `project: ${payload.projectId}`,
              `type: ${payload.type}`,
              "",
              payload.description,
              "",
              "<!-- codex-task-payload",
              JSON.stringify({
                ...payload,
                requestedBy: authConfig?.user?.login || "",
                createdAt: new Date().toISOString(),
              }),
              "-->",
            ].join("\n"),
            labels: ["codex-task"],
          }),
        });
        setTransientNotice(
          locale === "zh-CN" ? `项目请求已入队：Issue #${issue.number}` : `Project queued via issue #${issue.number}`,
        );
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId: "dashboard-ui",
            type: "project_create",
            title: `Create project: ${name}`,
            description: description || `Create a new Codex-managed project named ${name}.`,
            requestedProject: {
              id: slugify(name),
              name,
              description,
              repository,
              visibility,
              autoCreateRepo,
            },
          }),
        });
        setTransientNotice(
          locale === "zh-CN"
            ? `项目请求已入队：Issue #${queued.issue.number}`
            : `Project queued via issue #${queued.issue.number}`,
        );
      } else {
        await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            repository,
            visibility,
            autoCreateRepo,
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "项目已创建" : "Project created");
      }
      (event.currentTarget as HTMLFormElement).reset();
      setCreateDialogMode(null);
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const type = String(form.get("type") || "task").trim();
      const projectId = getTaskProjectId(type, String(form.get("projectId") || "").trim());
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = { projectId, type, title, description };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body: [
              `project: ${projectId}`,
              `type: ${type}`,
              "",
              description,
              "",
              "<!-- codex-task-payload",
              JSON.stringify({
                ...payload,
                routingMode: projectId === AUTO_ROUTE_PROJECT_ID ? "ai" : "fixed",
                requestedBy: authConfig?.user?.login || "",
                createdAt: new Date().toISOString(),
              }),
              "-->",
            ].join("\n"),
            labels: ["codex-task"],
          }),
        });
        setTransientNotice(locale === "zh-CN" ? `任务已入队：Issue #${issue.number}` : `Task queued via issue #${issue.number}`);
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            type,
            title,
            description,
          }),
        });
        setTransientNotice(
          locale === "zh-CN"
            ? `任务已入队：Issue #${queued.issue.number}`
            : `Task queued via issue #${queued.issue.number}`,
        );
      } else {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            type,
            title,
            description,
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "任务已创建" : "Task created");
      }
      (event.currentTarget as HTMLFormElement).reset();
      setCreateDialogMode(null);
      await refreshTasks();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function loginWithGithub() {
    if (runtimeMode === "github-direct") {
      const token = window.prompt(
        locale === "zh-CN"
          ? "输入一个可访问仓库 issue 的 GitHub Token。建议使用 fine-grained token，并授予 Issues 读写、Metadata 读取权限。"
          : "Paste a GitHub token with repository issue access. A fine-grained token with Issues read/write and Metadata read is recommended.",
        githubToken,
      );
      const normalized = String(token || "").trim();
      if (!normalized) {
        return;
      }

      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${normalized}`,
          },
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message || "Invalid GitHub token");
        }
        localStorage.setItem("codex.githubAccessToken", normalized);
        setGithubToken(normalized);
        setTransientNotice(locale === "zh-CN" ? "GitHub 已连接" : "GitHub connected");
        await refreshAll();
      } catch (error) {
        setTransientNotice(summarizeError(error));
      }
      return;
    }

    if (!authConfig?.enabled || authConfig.mode !== "github-device") {
      setTransientNotice(locale === "zh-CN" ? "服务器未启用 GitHub 设备流登录" : "GitHub device flow is not enabled");
      return;
    }

    try {
      const device = await api<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      }>("/api/auth/device/start", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const session: DeviceLoginSession = {
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        expiresAt: Date.now() + device.expires_in * 1000,
        intervalSec: device.interval || 5,
        status: locale === "zh-CN" ? "等待你在 GitHub 输入验证码..." : "Waiting for authorization on GitHub...",
        error: "",
      };
      setDeviceLogin(session);
      const myPollToken = ++pollTokenRef.current;
      void pollDeviceLogin(session, myPollToken);
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function pollDeviceLogin(session: DeviceLoginSession, pollToken: number) {
    while (Date.now() < session.expiresAt) {
      if (pollToken !== pollTokenRef.current) return;
      await sleep(session.intervalSec * 1000);
      try {
        const polled = runtimeMode === "github-direct"
          ? await fetch("https://github.com/login/oauth/access_token", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: GITHUB_CLIENT_ID,
                device_code: session.deviceCode,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              }),
            }).then((response) => response.json() as Promise<{
              access_token?: string;
              error?: string;
              error_description?: string;
              interval?: number;
            }>)
          : await api<{
              sessionToken?: string;
              error?: string;
              error_description?: string;
            }>("/api/auth/device/poll", {
              method: "POST",
              body: JSON.stringify({ deviceCode: session.deviceCode }),
            });

        if ("access_token" in polled && polled.access_token) {
          localStorage.setItem("codex.githubAccessToken", polled.access_token);
          setGithubToken(polled.access_token);
          setDeviceLogin((prev) =>
            prev
              ? {
                  ...prev,
                  status: locale === "zh-CN" ? "登录成功，正在刷新界面..." : "Signed in. Refreshing dashboard...",
                }
              : prev,
          );
          await refreshAll();
          window.setTimeout(() => setDeviceLogin(null), 1200);
          return;
        }

        if ("sessionToken" in polled && polled.sessionToken) {
          localStorage.setItem("codex.sessionToken", polled.sessionToken);
          setSessionToken(polled.sessionToken);
          setDeviceLogin((prev) =>
            prev
              ? {
                  ...prev,
                  status: locale === "zh-CN" ? "登录成功，正在刷新界面..." : "Signed in. Refreshing dashboard...",
                }
              : prev,
          );
          await refreshAll();
          window.setTimeout(() => setDeviceLogin(null), 1200);
          return;
        }

        if (polled.error && polled.error !== "authorization_pending" && polled.error !== "slow_down") {
          throw new Error(polled.error_description || polled.error);
        }
      } catch (error) {
        setDeviceLogin((prev) =>
          prev
            ? {
                ...prev,
                error: summarizeError(error),
                status: locale === "zh-CN" ? "登录失败，请重试" : "Login failed. Please retry.",
              }
            : prev,
        );
        return;
      }
    }

    setDeviceLogin((prev) =>
      prev
        ? {
            ...prev,
            status: locale === "zh-CN" ? "设备码已过期，请重新发起登录" : "Device code expired. Start again.",
          }
        : prev,
    );
  }

  async function copyDeviceCode() {
    if (!deviceLogin) return;
    try {
      await navigator.clipboard.writeText(deviceLogin.userCode);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setTransientNotice(locale === "zh-CN" ? "复制失败，请手动复制" : "Clipboard copy failed. Copy manually.");
    }
  }

  function cancelDeviceLogin() {
    pollTokenRef.current += 1;
    setDeviceLogin(null);
  }

  async function logout() {
    if (runtimeMode === "github-direct") {
      pollTokenRef.current += 1;
      localStorage.removeItem("codex.githubAccessToken");
      setGithubToken("");
      setDeviceLogin(null);
      await refreshAll();
      return;
    }
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Ignore server-side logout failure, local token is still cleared.
    } finally {
      pollTokenRef.current += 1;
      localStorage.removeItem("codex.sessionToken");
      setSessionToken("");
      setDeviceLogin(null);
      await refreshAll();
    }
  }

  async function mutateTask(taskId: string, action: "stop" | "retry") {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (runtimeMode === "github-direct") {
        if (!task?.issueNumber) {
          throw new Error(locale === "zh-CN" ? "当前任务没有对应的 Issue 编号" : "This task is missing an issue number");
        }
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        await githubRequest(`/repos/${owner}/${repoName}/issues/${task.issueNumber}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: action === "stop" ? "/stop" : "/retry" }),
        });
      } else {
        await api(`/api/tasks/${taskId}/${action}`, { method: "POST" });
      }
      setTransientNotice(action === "stop" ? (locale === "zh-CN" ? "已发送停止指令" : "Stop requested") : locale === "zh-CN" ? "已重试任务" : "Task retried");
      await refreshTasks();
      await refreshApprovals();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function respondToTask(taskId: string, decision: "approve" | "reject", feedback: string) {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (runtimeMode === "github-direct") {
        if (!task?.issueNumber) {
          throw new Error(locale === "zh-CN" ? "当前任务没有对应的 Issue 编号" : "This task is missing an issue number");
        }
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const command = decision === "approve" ? `/approve ${feedback}`.trim() : `/reject ${feedback}`.trim();
        await githubRequest(`/repos/${owner}/${repoName}/issues/${task.issueNumber}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: command }),
        });
      } else {
        await api(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          body: JSON.stringify({ decision, feedback }),
        });
      }
      setTransientNotice(locale === "zh-CN" ? "审批结果已提交" : "Decision submitted");
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setWorkspaceLevel("tasks");
  }

  function openTask(task: Task) {
    setSelectedProjectId(task.projectId);
    setSelectedTaskId(task.id);
    setWorkspaceLevel("detail");
  }

  function handleBack() {
    if (workspaceLevel === "detail") {
      setWorkspaceLevel("tasks");
      return;
    }
    if (workspaceLevel === "tasks") {
      setWorkspaceLevel("projects");
    }
  }

  const breadcrumbs = [
    { key: "projects", label: locale === "zh-CN" ? "项目" : "Projects", active: workspaceLevel === "projects", onClick: () => setWorkspaceLevel("projects") },
    ...(selectedProject
      ? [
          {
            key: "tasks",
            label: getProjectDisplayName(selectedProject.id, locale),
            active: workspaceLevel === "tasks",
            onClick: () => {
              setSelectedProjectId(selectedProject.id);
              setWorkspaceLevel("tasks");
            },
          },
        ]
      : []),
    ...(selectedTask
      ? [
          {
            key: "detail",
            label: selectedTask.title,
            active: workspaceLevel === "detail",
            onClick: () => {
              openTask(selectedTask);
            },
          },
        ]
      : []),
  ];

  const workspaceTitle =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "项目列表"
        : "Projects"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "任务列表"
          : "Tasks"
        : t.taskDetails;

  const workspaceDescription =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "先选择项目，再进入对应任务列表。"
        : "Choose a project first, then inspect its tasks."
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? `${getProjectDisplayName(selectedProject?.id || "", locale) || "当前项目"} 下的任务`
          : `Tasks under ${getProjectDisplayName(selectedProject?.id || "", locale) || "the current project"}`
        : locale === "zh-CN"
          ? "只展示当前任务的详情与操作。"
          : "Focused detail view for the active task.";

  const createLabel =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "新建项目"
        : "New project"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "新建任务"
          : "New task"
        : "";

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div>
            <div className="brand-title">{t.title}</div>
            <div className="brand-subtitle">{t.subtitle}</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="api-pill">
            {runtimeMode === "github-direct" ? (locale === "zh-CN" ? "任务队列：" : "Task queue:") : t.localApi}
            <code>{runtimeMode === "github-direct" ? GITHUB_TASK_REPO : DEFAULT_API_BASE}</code>
          </div>
          <button type="button" className="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? (locale === "zh-CN" ? "浅色" : "Light") : locale === "zh-CN" ? "深色" : "Dark"}
          </button>
          <button type="button" className="ghost" onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
            {locale === "zh-CN" ? "English" : "中文"}
          </button>
        </div>
      </header>

      <section className="status-strip">
        <div>{connectionStatus}</div>
        <div>{authStatus}</div>
      </section>

      {deviceLogin ? (
        <section className="device-card">
          <div className="section-head">
            <h3>{locale === "zh-CN" ? "GitHub 设备登录" : "GitHub Device Login"}</h3>
            <button type="button" className="ghost" onClick={cancelDeviceLogin}>
              {locale === "zh-CN" ? "关闭" : "Close"}
            </button>
          </div>
          <p className="hint">
            {locale === "zh-CN"
              ? "请先打开下方链接，然后输入验证码。整个流程可在当前页面完成轮询。"
              : "Open the URL below and enter your code. Polling continues in this page."}
          </p>
          <div className="device-row">
            <a href={deviceLogin.verificationUri} target="_blank" rel="noreferrer">
              {deviceLogin.verificationUri}
            </a>
            <button type="button" className="primary" onClick={() => void copyDeviceCode()}>
              {copyState === "copied" ? (locale === "zh-CN" ? "已复制" : "Copied") : locale === "zh-CN" ? "复制验证码" : "Copy code"}
            </button>
          </div>
          <div className="code-box">{deviceLogin.userCode}</div>
          <div className="hint">{deviceLogin.status}</div>
          {deviceLogin.error ? <pre className="error-box">{deviceLogin.error}</pre> : null}
        </section>
      ) : null}

      {notice ? <section className="notice">{notice}</section> : null}

      <nav className="tabs" aria-label="Primary">
        {tabs.map((tab) => (
          <button key={tab.id} className={tab.id === activeTab ? "tab active" : "tab"} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label[locale]}
          </button>
        ))}
        <div className="spacer" />
        <button
          type="button"
          className="ghost"
          onClick={() => void loginWithGithub()}
          disabled={runtimeMode === "github-direct" ? Boolean(authConfig?.user) : !authConfig?.enabled || Boolean(authConfig?.user)}
        >
          {t.loginButton}
        </button>
        <button type="button" className="ghost" onClick={() => void logout()} disabled={!authConfig?.user}>
          {t.logoutButton}
        </button>
      </nav>

      <div className="mobile-nav-fab">
        <button
          type="button"
          className="mobile-nav-trigger"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-nav-sheet"
          onClick={() => setIsMobileNavOpen((open) => !open)}
        >
          <span className="mobile-nav-trigger-label">{tabs.find((tab) => tab.id === activeTab)?.label[locale]}</span>
          <span className="mobile-nav-trigger-meta">{locale === "zh-CN" ? "导航与账户" : "Nav & account"}</span>
        </button>
      </div>

      {isMobileNavOpen ? (
        <div className="mobile-nav-backdrop" role="presentation" onClick={() => setIsMobileNavOpen(false)}>
          <div
            id="mobile-nav-sheet"
            className="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "zh-CN" ? "移动端导航" : "Mobile navigation"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h3>{locale === "zh-CN" ? "快速切换" : "Quick switch"}</h3>
              <button type="button" className="ghost" onClick={() => setIsMobileNavOpen(false)}>
                {locale === "zh-CN" ? "关闭" : "Close"}
              </button>
            </div>
            <div className="mobile-nav-tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={tab.id === activeTab ? "tab active" : "tab"}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label[locale]}
                </button>
              ))}
            </div>
            <div className="mobile-nav-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                }}
              >
                {theme === "dark" ? (locale === "zh-CN" ? "浅色" : "Light") : locale === "zh-CN" ? "深色" : "Dark"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setLocale(locale === "zh-CN" ? "en-US" : "zh-CN");
                }}
              >
                {locale === "zh-CN" ? "English" : "中文"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void loginWithGithub()}
                disabled={runtimeMode === "github-direct" ? Boolean(authConfig?.user) : !authConfig?.enabled || Boolean(authConfig?.user)}
              >
                {t.loginButton}
              </button>
              <button type="button" className="ghost" onClick={() => void logout()} disabled={!authConfig?.user}>
                {t.logoutButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "quest-center" && (
        <section className="workspace-shell">
          <article className="card workspace-panel">
            <div className="workspace-toolbar">
              <div className="toolbar-left">
                {workspaceLevel !== "projects" ? (
                  <button type="button" className="ghost" onClick={handleBack}>
                    {locale === "zh-CN" ? "返回" : "Back"}
                  </button>
                ) : null}
                <div className="breadcrumb-row" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb) => (
                    <div key={crumb.key} className="breadcrumb-item">
                      <button
                        type="button"
                        className={crumb.active ? "breadcrumb active" : "breadcrumb"}
                        onClick={crumb.onClick}
                      >
                        {crumb.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="toolbar-actions">
                <button className="ghost" type="button" onClick={() => void refreshAll()}>
                  {t.refresh}
                </button>
                {workspaceLevel === "projects" ? (
                  <button type="button" className="ghost" onClick={() => setCreateDialogMode("composite_task")}>
                    {locale === "zh-CN" ? "模糊/组合任务" : "Composite task"}
                  </button>
                ) : null}
                {createLabel ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setCreateDialogMode(workspaceLevel === "projects" ? "project" : "task")}
                  >
                    {createLabel}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="panel-intro">
              <div>
                <h2>{workspaceTitle}</h2>
                <div className="meta">{workspaceDescription}</div>
              </div>
            </div>

            {workspaceLevel === "projects" ? (
              <div className="entity-grid">
                {projects.length ? (
                  projects.map((project) => (
                    <button key={project.id} type="button" className="entity-card project-card" onClick={() => openProject(project.id)}>
                      <div className="entity-topline">
                        <span className="entity-icon" aria-hidden="true">
                          ▣
                        </span>
                        <span className="title">{getProjectDisplayName(project.id, locale)}</span>
                      </div>
                      <div className="meta clamp-2">
                        {(project.id === AUTO_ROUTE_PROJECT_ID
                          ? locale === "zh-CN"
                            ? "模糊或跨项目任务暂存区，等待 AI 判断路由。"
                            : "Staging area for composite or cross-project tasks before AI routing."
                          : project.description) || (locale === "zh-CN" ? "暂无项目描述" : "No description")}
                      </div>
                      <div className="entity-footer">
                        <span className="meta">{project.repository || (locale === "zh-CN" ? "未绑定仓库" : "No repository")}</span>
                        <span className="stats-pill">
                          {project.taskStats.running}/{project.taskStats.total}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="detail-empty">{locale === "zh-CN" ? "暂无项目" : "No projects"}</div>
                )}
              </div>
            ) : null}

            {workspaceLevel === "tasks" ? (
              <div className="entity-grid">
                {selectedProjectTasks.length ? (
                  selectedProjectTasks.map((task) => (
                    <button key={task.id} type="button" className="entity-card task-card" onClick={() => openTask(task)}>
                      <div className="entity-topline">
                        <span className="title clamp-2">{task.title}</span>
                        <span className={`badge status-${task.status}`}>{statusLabel[task.status][locale]}</span>
                      </div>
                      <div className="meta">
                        {getProjectDisplayName(task.projectId, locale)} · {task.type}
                      </div>
                      <div className="clamp-3 entity-copy">{task.description || (locale === "zh-CN" ? "暂无描述" : "No description")}</div>
                    </button>
                  ))
                ) : (
                  <div className="detail-empty">{locale === "zh-CN" ? "当前项目暂无任务" : "No tasks in this project"}</div>
                )}
              </div>
            ) : null}

            {workspaceLevel === "detail" ? (
              selectedTask ? (
                <TaskDetail task={selectedTask} locale={locale} onMutate={mutateTask} onRespond={respondToTask} />
              ) : (
                <div className="detail-empty">{t.noTask}</div>
              )
            ) : null}
          </article>

          <article className="card side-panel">
            <div className="section-head">
              <h2>{t.pendingApprovals}</h2>
              <button className="ghost" type="button" onClick={() => void refreshApprovals()}>
                {t.refresh}
              </button>
            </div>
            <div className="stack">
              {approvals.length ? (
                approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    locale={locale}
                    onRespond={respondToTask}
                    onOpenTask={(taskId) => {
                      const task = tasks.find((item) => item.id === taskId);
                      if (!task) return;
                      openTask(task);
                    }}
                  />
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "当前没有待审批" : "No approvals pending"}</div>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "tools" && (
        <section className="single-panel">
          <article className="card">
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "工具路由" : "Tool routes"}</h2>
            </div>
            <div className="stack">
              {tools.length ? (
                tools.map((tool) => (
                  <div key={tool.id} className="tool-item">
                    <div className="title">{tool.name}</div>
                    <div className="meta">{tool.description || (locale === "zh-CN" ? "无描述" : "No description")}</div>
                    <a className="meta link wrap-anywhere" href={tool.route} target="_blank" rel="noreferrer">
                      {locale === "zh-CN" ? `打开 ${tool.route}` : `Open ${tool.route}`}
                    </a>
                  </div>
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "暂无工具路由" : "No tools"}</div>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "usage" && (
        <section className="single-panel">
          <article className="card">
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "运行用量快照" : "Usage snapshot"}</h2>
            </div>
            <div className="usage-grid">
              {usage
                ? [
                    [locale === "zh-CN" ? "总任务数" : "Total tasks", usage.totalTasks],
                    [locale === "zh-CN" ? "活动任务" : "Active tasks", usage.activeTasks],
                    [locale === "zh-CN" ? "待审批" : "Pending approvals", usage.pendingApprovals],
                    [locale === "zh-CN" ? "已完成" : "Completed", usage.completedTasks],
                    [locale === "zh-CN" ? "失败" : "Failed", usage.failedTasks],
                    [locale === "zh-CN" ? "预估 token" : "Token estimate", usage.estimatedTokens],
                    [locale === "zh-CN" ? "Worker 运行次数" : "Worker runs", usage.totalRuns],
                    [locale === "zh-CN" ? "最近运行" : "Last run", usage.lastRunAt || "n/a"],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="usage-item">
                      <div className="meta">{label}</div>
                      <div className="title wrap-anywhere">{String(value)}</div>
                    </div>
                  ))
                : <div className="detail-empty">{locale === "zh-CN" ? "暂无用量数据" : "No usage data"}</div>}
            </div>
          </article>
        </section>
      )}

      {createDialogMode ? (
        <CreateDialog
          locale={locale}
          mode={createDialogMode}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onClose={() => setCreateDialogMode(null)}
          onCreateProject={onCreateProject}
          onCreateTask={onCreateTask}
        />
      ) : null}
    </div>
  );
}

function CreateDialog({
  locale,
  mode,
  projects,
  selectedProjectId,
  onClose,
  onCreateProject,
  onCreateTask,
}: {
  locale: Locale;
  mode: CreateDialogMode;
  projects: Project[];
  selectedProjectId: string;
  onClose: () => void;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const title =
    mode === "project"
      ? locale === "zh-CN"
        ? "创建项目"
        : "Create project"
      : mode === "composite_task"
        ? locale === "zh-CN"
          ? "创建模糊/组合任务"
          : "Create composite task"
      : locale === "zh-CN"
        ? "创建任务"
        : "Create task";

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-head">
          <h3>{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>
            {locale === "zh-CN" ? "关闭" : "Close"}
          </button>
        </div>

        {mode === "project" ? (
          <form className="stack compact" onSubmit={onCreateProject}>
            <input name="name" placeholder={locale === "zh-CN" ? "项目名称" : "Project name"} required />
            <textarea name="description" rows={4} placeholder={locale === "zh-CN" ? "目标 / 范围 / 备注" : "Goal / scope / notes"} />
            <input name="repository" placeholder="GitHub URL (optional)" />
            <select name="visibility" defaultValue="private">
              <option value="private">{locale === "zh-CN" ? "私有仓库" : "Private repo"}</option>
              <option value="public">{locale === "zh-CN" ? "公开仓库" : "Public repo"}</option>
            </select>
            <label className="check-row">
              <input type="checkbox" name="autoCreateRepo" />
              <span>{locale === "zh-CN" ? "自动创建 GitHub 仓库" : "Auto-create GitHub repository"}</span>
            </label>
            <button type="submit" className="primary">{locale === "zh-CN" ? "创建项目" : "Create project"}</button>
          </form>
        ) : (
          <form className="stack compact" onSubmit={onCreateTask}>
            {mode === "task" ? (
              <select name="projectId" defaultValue={selectedProjectId || projects[0]?.id}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {getProjectDisplayName(project.id, locale)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="form-note">
                {locale === "zh-CN"
                  ? "该任务从项目层级发起，不预先绑定项目，由 AI 判断应归属到哪个项目，或是否需要拆分到多个项目。"
                  : "This task starts from the project layer without a fixed project. AI will decide the target project or split it across multiple projects."}
              </div>
            )}
            <input type="hidden" name="type" value={mode === "composite_task" ? "composite_task" : "task"} />
            <input name="title" placeholder={locale === "zh-CN" ? "任务标题" : "Task title"} required />
            <textarea name="description" rows={5} placeholder={locale === "zh-CN" ? "希望 Codex 完成什么" : "What should Codex do?"} required />
            <button type="submit" className="primary">{locale === "zh-CN" ? "创建任务" : "Create task"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function TaskDetail({
  task,
  locale,
  onMutate,
  onRespond,
}: {
  task: Task;
  locale: Locale;
  onMutate: (taskId: string, action: "stop" | "retry") => Promise<void>;
  onRespond: (taskId: string, decision: "approve" | "reject", feedback: string) => Promise<void>;
}) {
  return (
    <div className="detail-card">
      <div className="detail-hero">
        <div>
          <div className="meta">
            {getProjectDisplayName(task.projectId, locale)} · {task.type}
          </div>
          <h3 className="wrap-anywhere">{task.title}</h3>
          <div className="meta">
            {locale === "zh-CN" ? "状态：" : "Status: "}
            {statusLabel[task.status][locale]}
          </div>
        </div>
        <div className="action-row detail-actions">
          {task.status === "waiting_user" ? (
            <>
              <button type="button" className="primary" onClick={() => void onRespond(task.id, "approve", "")}>
                {locale === "zh-CN" ? "通过" : "Approve"}
              </button>
              <button type="button" className="ghost" onClick={() => void onRespond(task.id, "reject", "")}>
                {locale === "zh-CN" ? "拒绝" : "Reject"}
              </button>
            </>
          ) : null}
          {task.status === "running" ? (
            <button type="button" className="ghost" onClick={() => void onMutate(task.id, "stop")}>
              {locale === "zh-CN" ? "停止" : "Stop"}
            </button>
          ) : null}
          {task.status === "failed" || task.status === "stopped" ? (
            <button type="button" className="ghost" onClick={() => void onMutate(task.id, "retry")}>
              {locale === "zh-CN" ? "重试" : "Retry"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="detail-grid">
        <div className="info-card">
          <div className="info-label">{locale === "zh-CN" ? "描述" : "Description"}</div>
          <div className="wrap-anywhere">{task.description || (locale === "zh-CN" ? "暂无描述" : "No description")}</div>
        </div>

        {task.planPreview ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "计划预览" : "Plan preview"}</div>
            <div className="wrap-anywhere">{task.planPreview}</div>
          </div>
        ) : null}

        {task.summary ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "摘要" : "Summary"}</div>
            <div className="wrap-anywhere">{task.summary}</div>
          </div>
        ) : null}

        {task.branchName ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "分支" : "Branch"}</div>
            <div className="wrap-anywhere">{task.branchName}</div>
          </div>
        ) : null}

        {task.workspacePath ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "工作区" : "Workspace"}</div>
            <div className="wrap-anywhere">{task.workspacePath}</div>
          </div>
        ) : null}

        {task.children.length ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "子任务" : "Child tasks"}</div>
            <div className="wrap-anywhere">
              {task.children.map((child) => `${child.title} (${statusLabel[child.status][locale]})`).join("\n")}
            </div>
          </div>
        ) : null}
      </div>

      <div className="log-list">
        {task.logs.length ? (
          task.logs.map((entry) => (
            <div key={`${entry.timestamp}-${entry.message}`} className="log-item">
              <div className="meta">{new Date(entry.timestamp).toLocaleString(locale)}</div>
              <div className="wrap-anywhere">{entry.message}</div>
            </div>
          ))
        ) : (
          <div className="detail-empty">{locale === "zh-CN" ? "暂无关键日志" : "No important logs yet"}</div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  locale,
  onRespond,
  onOpenTask,
}: {
  approval: Approval;
  locale: Locale;
  onRespond: (taskId: string, decision: "approve" | "reject", feedback: string) => Promise<void>;
  onOpenTask: (taskId: string) => void;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="approval-item">
      <div className="title wrap-anywhere">{approval.task.title}</div>
      <div className="meta wrap-anywhere">{approval.reason}</div>
      <div className="meta">
        {getProjectDisplayName(approval.task.projectId, locale)} · {approval.task.type}
      </div>
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={locale === "zh-CN" ? "可选：审批反馈或限制条件" : "Optional feedback or constraints"}
      />
      <div className="action-row">
        <button type="button" className="primary" onClick={() => void onRespond(approval.task.id, "approve", feedback)}>
          {locale === "zh-CN" ? "通过" : "Approve"}
        </button>
        <button type="button" className="ghost" onClick={() => void onRespond(approval.task.id, "reject", feedback)}>
          {locale === "zh-CN" ? "拒绝" : "Reject"}
        </button>
        <button type="button" className="ghost" onClick={() => onOpenTask(approval.task.id)}>
          {locale === "zh-CN" ? "打开任务" : "Open task"}
        </button>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
