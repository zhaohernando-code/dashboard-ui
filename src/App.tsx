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

const DEFAULT_API_BASE = "http://localhost:8787";

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

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("codex.locale");
    if (saved === "zh-CN" || saved === "en-US") return saved;
    return navigator.language.startsWith("zh") ? "zh-CN" : "en-US";
  });
  const [sessionToken, setSessionToken] = useState(localStorage.getItem("codex.sessionToken") || "");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<Array<{ id: string; name: string; route: string; description: string }>>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [authStatus, setAuthStatus] = useState("");
  const [deviceLogin, setDeviceLogin] = useState<DeviceLoginSession | null>(null);
  const [notice, setNotice] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const pollTokenRef = useRef(0);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const project of projects) map.set(project.id, []);
    for (const task of tasks) {
      const list = map.get(task.projectId) || [];
      list.push(task);
      map.set(task.projectId, list);
    }
    return map;
  }, [projects, tasks]);

  const visibleTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((task) => task.projectId === selectedProjectId) : tasks),
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
        clearFilter: locale === "zh-CN" ? "清除筛选" : "Clear filter",
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
    void refreshAll();
    const interval = window.setInterval(() => {
      void refreshTasks();
      void refreshApprovals();
      void refreshUsage();
      void refreshAuth();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [sessionToken]);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

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
    try {
      const payload = await api<{ projects: Project[] }>("/api/projects");
      setProjects(payload.projects);
      if (!selectedProjectId && payload.projects.length) {
        setSelectedProjectId(payload.projects[0].id);
      }
    } catch {
      setProjects([]);
    }
  }

  async function refreshTasks() {
    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      setTasks(payload.tasks);
      if (!selectedTaskId && payload.tasks.length) {
        setSelectedTaskId(payload.tasks[0].id);
      }
    } catch {
      setTasks([]);
    }
  }

  async function refreshApprovals() {
    try {
      const payload = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(payload.approvals.filter((approval) => approval.task.status === "waiting_user"));
    } catch {
      setApprovals([]);
    }
  }

  async function refreshTools() {
    try {
      const payload = await api<{ tools: Array<{ id: string; name: string; route: string; description: string }> }>("/api/tools");
      setTools(payload.tools);
    } catch {
      setTools([]);
    }
  }

  async function refreshUsage() {
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

      if (authConfig?.taskBackend === "github-issues") {
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
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const projectId = String(form.get("projectId") || "").trim();
      const type = String(form.get("type") || "task").trim();
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();

      if (authConfig?.taskBackend === "github-issues") {
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
      await refreshTasks();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function loginWithGithub() {
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
        const polled = await api<{
          sessionToken?: string;
          error?: string;
          error_description?: string;
        }>("/api/auth/device/poll", {
          method: "POST",
          body: JSON.stringify({ deviceCode: session.deviceCode }),
        });

        if (polled.sessionToken) {
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
      await api(`/api/tasks/${taskId}/${action}`, { method: "POST" });
      setTransientNotice(action === "stop" ? (locale === "zh-CN" ? "已发送停止指令" : "Stop requested") : locale === "zh-CN" ? "已重试任务" : "Task retried");
      await refreshTasks();
      await refreshApprovals();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

  async function respondToTask(taskId: string, decision: "approve" | "reject", feedback: string) {
    try {
      await api(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision, feedback }),
      });
      setTransientNotice(locale === "zh-CN" ? "审批结果已提交" : "Decision submitted");
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error));
    }
  }

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
            {t.localApi}
            <code>{DEFAULT_API_BASE}</code>
          </div>
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
            <button type="button" onClick={() => void copyDeviceCode()}>
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
          disabled={!authConfig?.enabled || Boolean(authConfig.user)}
        >
          {t.loginButton}
        </button>
        <button type="button" className="ghost" onClick={() => void logout()} disabled={!authConfig?.user}>
          {t.logoutButton}
        </button>
      </nav>

      {activeTab === "quest-center" && (
        <section className="workspace-grid">
          <article className="card tree-card">
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "项目目录" : "Project tree"}</h2>
              <button className="ghost" type="button" onClick={() => void refreshProjects()}>
                {t.refresh}
              </button>
            </div>
            <div className="hint folder-hint">{locale === "zh-CN" ? "文件夹关系：项目下包含任务" : "Folder relation: project contains tasks"}</div>
            <div className="tree-list">
              {projects.length ? (
                projects.map((project) => {
                  const isSelected = selectedProjectId === project.id;
                  const projectTasks = tasksByProject.get(project.id) || [];
                  return (
                    <div key={project.id} className={isSelected ? "project-node selected" : "project-node"}>
                      <button type="button" className="project-head" onClick={() => setSelectedProjectId(project.id)}>
                        <span className="folder-icon" aria-hidden="true">
                          {isSelected ? "📂" : "📁"}
                        </span>
                        <span>{project.name}</span>
                        <span className="meta">{project.taskStats.running}/{project.taskStats.total}</span>
                      </button>
                      <div className="task-children">
                        {projectTasks.length ? (
                          projectTasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              className={selectedTaskId === task.id ? "task-leaf active" : "task-leaf"}
                              onClick={() => {
                                setSelectedProjectId(task.projectId);
                                setSelectedTaskId(task.id);
                              }}
                            >
                              <span className="leaf-dot" aria-hidden="true" />
                              <span>{task.title}</span>
                              <span className={`badge status-${task.status}`}>{statusLabel[task.status][locale]}</span>
                            </button>
                          ))
                        ) : (
                          <div className="meta empty-sub">{locale === "zh-CN" ? "暂无任务" : "No tasks"}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "暂无项目" : "No projects"}</div>
              )}
            </div>
          </article>

          <article className="card center-card">
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "任务面板" : "Task board"}</h2>
              <button className="ghost" type="button" onClick={() => setSelectedProjectId("")}>
                {t.clearFilter}
              </button>
            </div>
            <div className="meta board-meta">
              {selectedProject
                ? locale === "zh-CN"
                  ? `当前项目：${selectedProject.name}`
                  : `Current project: ${selectedProject.name}`
                : locale === "zh-CN"
                  ? "当前查看全部任务"
                  : "Showing tasks from all projects"}
            </div>

            <div className="task-board">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <button key={task.id} className={selectedTaskId === task.id ? "task-card selected" : "task-card"} type="button" onClick={() => setSelectedTaskId(task.id)}>
                    <span className="title">{task.title}</span>
                    <span className="meta">
                      {task.projectName} · {task.type}
                    </span>
                    <span className={`badge status-${task.status}`}>{statusLabel[task.status][locale]}</span>
                  </button>
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "暂无任务" : "No tasks"}</div>
              )}
            </div>

            <div className="create-grid">
              <form className="stack compact" onSubmit={onCreateProject}>
                <h3>{locale === "zh-CN" ? "新建项目" : "New project"}</h3>
                <input name="name" placeholder={locale === "zh-CN" ? "项目名称" : "Project name"} required />
                <textarea name="description" rows={3} placeholder={locale === "zh-CN" ? "目标 / 范围 / 备注" : "Goal / scope / notes"} />
                <input name="repository" placeholder="GitHub URL (optional)" />
                <select name="visibility" defaultValue="private">
                  <option value="private">{locale === "zh-CN" ? "私有仓库" : "Private repo"}</option>
                  <option value="public">{locale === "zh-CN" ? "公开仓库" : "Public repo"}</option>
                </select>
                <label className="check-row">
                  <input type="checkbox" name="autoCreateRepo" />
                  <span>{locale === "zh-CN" ? "自动创建 GitHub 仓库" : "Auto-create GitHub repository"}</span>
                </label>
                <button type="submit">{locale === "zh-CN" ? "创建项目" : "Create project"}</button>
              </form>

              <form className="stack compact" onSubmit={onCreateTask}>
                <h3>{locale === "zh-CN" ? "新建任务" : "New task"}</h3>
                <select name="projectId" defaultValue={projects[0]?.id}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select name="type" defaultValue="task">
                  <option value="task">{locale === "zh-CN" ? "直接任务" : "Direct task"}</option>
                  <option value="composite_task">{locale === "zh-CN" ? "模糊/组合任务" : "Composite task"}</option>
                </select>
                <input name="title" placeholder={locale === "zh-CN" ? "任务标题" : "Task title"} required />
                <textarea name="description" rows={4} placeholder={locale === "zh-CN" ? "希望 Codex 完成什么" : "What should Codex do?"} required />
                <button type="submit">{locale === "zh-CN" ? "创建任务" : "Create task"}</button>
              </form>
            </div>
          </article>

          <article className="card detail-pane">
            <div className="section-head">
              <h2>{t.taskDetails}</h2>
            </div>
            {selectedTask ? (
              <TaskDetail task={selectedTask} locale={locale} onMutate={mutateTask} onRespond={respondToTask} />
            ) : (
              <div className="detail-empty">{t.noTask}</div>
            )}

            <div className="separator" />

            <div className="section-head">
              <h2>{t.pendingApprovals}</h2>
              <button className="ghost" type="button" onClick={() => void refreshApprovals()}>
                {t.refresh}
              </button>
            </div>
            <div className="stack">
              {approvals.length ? (
                approvals.map((approval) => (
                  <ApprovalCard key={approval.id} approval={approval} locale={locale} onRespond={respondToTask} onOpenTask={setSelectedTaskId} />
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
                    <a className="meta link" href={tool.route} target="_blank" rel="noreferrer">
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
                      <div className="title">{String(value)}</div>
                    </div>
                  ))
                : <div className="detail-empty">{locale === "zh-CN" ? "暂无用量数据" : "No usage data"}</div>}
            </div>
          </article>
        </section>
      )}
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
      <div>
        <div className="meta">
          {task.projectName} · {task.type}
        </div>
        <h3>{task.title}</h3>
        <div className="meta">
          {locale === "zh-CN" ? "状态：" : "Status: "}
          {statusLabel[task.status][locale]}
        </div>
      </div>
      <div>{task.description || (locale === "zh-CN" ? "暂无描述" : "No description")}</div>
      {task.planPreview ? (
        <div className="log-item">
          <strong>{locale === "zh-CN" ? "计划预览" : "Plan preview"}</strong>
          <br />
          {task.planPreview}
        </div>
      ) : null}
      {task.summary ? (
        <div className="log-item">
          <strong>{locale === "zh-CN" ? "摘要" : "Summary"}</strong>
          <br />
          {task.summary}
        </div>
      ) : null}
      {task.branchName ? (
        <div className="log-item">
          <strong>{locale === "zh-CN" ? "分支" : "Branch"}</strong>
          <br />
          {task.branchName}
        </div>
      ) : null}
      {task.workspacePath ? (
        <div className="log-item">
          <strong>{locale === "zh-CN" ? "工作区" : "Workspace"}</strong>
          <br />
          {task.workspacePath}
        </div>
      ) : null}
      {task.children.length ? (
        <div className="log-item">
          <strong>{locale === "zh-CN" ? "子任务" : "Child tasks"}</strong>
          <br />
          {task.children.map((child) => `${child.title} (${statusLabel[child.status][locale]})`).join("\n")}
        </div>
      ) : null}
      <div className="action-row">
        {task.status === "waiting_user" ? (
          <>
            <button type="button" onClick={() => void onRespond(task.id, "approve", "")}> 
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
      <div className="log-list">
        {task.logs.length ? (
          task.logs.map((entry) => (
            <div key={`${entry.timestamp}-${entry.message}`} className="log-item">
              <div className="meta">{new Date(entry.timestamp).toLocaleString(locale)}</div>
              <div>{entry.message}</div>
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
      <div className="title">{approval.task.title}</div>
      <div className="meta">{approval.reason}</div>
      <div className="meta">
        {approval.task.projectName} · {approval.task.type}
      </div>
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={locale === "zh-CN" ? "可选：审批反馈或限制条件" : "Optional feedback or constraints"}
      />
      <div className="action-row">
        <button type="button" onClick={() => void onRespond(approval.task.id, "approve", feedback)}>
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
