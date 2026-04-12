import { FormEvent, useEffect, useMemo, useState } from "react";

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
  user: null | {
    login: string;
    name: string;
  };
};

const DEFAULT_API_BASE = "http://localhost:8787";

const tabs = [
  { id: "quest-center", label: "Quest Center" },
  { id: "tools", label: "Tools" },
  { id: "usage", label: "Usage" },
] as const;

export default function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem("codex.apiBase") || DEFAULT_API_BASE);
  const [draftApiBase, setDraftApiBase] = useState(apiBase);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem("codex.sessionToken") || "");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<Array<{ id: string; name: string; route: string; description: string }>>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Waiting for health check.");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [authStatus, setAuthStatus] = useState("Auth status unknown.");

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const visibleTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((task) => task.projectId === selectedProjectId) : tasks),
    [selectedProjectId, tasks],
  );

  useEffect(() => {
    void refreshAll();
    const interval = window.setInterval(() => {
      void refreshTasks();
      void refreshApprovals();
      void refreshUsage();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [apiBase, sessionToken]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBase}${path}`, {
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

  async function refreshAll() {
    await Promise.all([refreshHealth(), refreshAuth(), refreshProjects(), refreshTasks(), refreshApprovals(), refreshTools(), refreshUsage()]);
  }

  async function refreshHealth() {
    try {
      const payload = await api<{ serverName: string; host: string }>("/api/health");
      setConnectionStatus(`Connected to ${payload.serverName} on ${payload.host}`);
    } catch (error) {
      setConnectionStatus((error as Error).message);
    }
  }

  async function refreshAuth() {
    try {
      const payload = await api<AuthConfig>("/api/auth/config");
      setAuthConfig(payload);
      if (!payload.enabled) {
        setAuthStatus("Auth disabled on server.");
      } else if (payload.user) {
        setAuthStatus(`Authenticated as ${payload.user.login}`);
      } else {
        setAuthStatus("Not authenticated.");
      }
    } catch (error) {
      setAuthStatus((error as Error).message);
    }
  }

  async function refreshProjects() {
    try {
      const payload = await api<{ projects: Project[] }>("/api/projects");
      setProjects(payload.projects);
    } catch {
      setProjects([]);
    }
  }

  async function refreshTasks() {
    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      setTasks(payload.tasks);
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

  async function onSaveEndpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextApiBase = draftApiBase.trim() || DEFAULT_API_BASE;
    localStorage.setItem("codex.apiBase", nextApiBase);
    setApiBase(nextApiBase);
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        repository: form.get("repository"),
        visibility: form.get("visibility"),
        autoCreateRepo: form.get("autoCreateRepo") === "on",
      }),
    });
    (event.currentTarget as HTMLFormElement).reset();
    await refreshAll();
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        projectId: form.get("projectId"),
        type: form.get("type"),
        title: form.get("title"),
        description: form.get("description"),
      }),
    });
    (event.currentTarget as HTMLFormElement).reset();
    await refreshTasks();
  }

  async function loginWithGithub() {
    if (!authConfig?.enabled || authConfig.mode !== "github-device") {
      window.alert("GitHub device flow is not enabled on the server.");
      return;
    }

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

    window.alert(`Open ${device.verification_uri} and enter code ${device.user_code}`);
    const deadline = Date.now() + device.expires_in * 1000;

    while (Date.now() < deadline) {
      await sleep((device.interval || 5) * 1000);
      const polled = await api<{
        sessionToken?: string;
        error?: string;
        error_description?: string;
      }>("/api/auth/device/poll", {
        method: "POST",
        body: JSON.stringify({ deviceCode: device.device_code }),
      });

      if (polled.sessionToken) {
        localStorage.setItem("codex.sessionToken", polled.sessionToken);
        setSessionToken(polled.sessionToken);
        await refreshAll();
        return;
      }

      if (polled.error && polled.error !== "authorization_pending" && polled.error !== "slow_down") {
        throw new Error(polled.error_description || polled.error);
      }
    }

    throw new Error("GitHub device login timed out.");
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } finally {
      localStorage.removeItem("codex.sessionToken");
      setSessionToken("");
      await refreshAll();
    }
  }

  async function mutateTask(taskId: string, action: "stop" | "retry") {
    await api(`/api/tasks/${taskId}/${action}`, { method: "POST" });
    await refreshTasks();
    await refreshApprovals();
  }

  async function respondToTask(taskId: string, decision: "approve" | "reject", feedback: string) {
    await api(`/api/tasks/${taskId}/respond`, {
      method: "POST",
      body: JSON.stringify({ decision, feedback }),
    });
    await refreshAll();
  }

  return (
    <div className="page">
      <div className="bg-grid" aria-hidden="true" />
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Codex Control Plane</p>
            <h1>Typed React dashboard for autonomous local Codex workers.</h1>
            <p className="lede">
              Projects, tasks, approvals, usage, and GitHub-backed automation in a maintainable TypeScript frontend.
            </p>
          </div>
          <form className="card settings-card" onSubmit={onSaveEndpoint}>
            <div className="section-head">
              <h2>Connection</h2>
            </div>
            <label htmlFor="apiBase">API Base URL</label>
            <input id="apiBase" value={draftApiBase} onChange={(event) => setDraftApiBase(event.target.value)} />
            <button type="submit">Save endpoint</button>
            <p className="hint">{connectionStatus}</p>
            <div className="auth-box">
              <div className="hint">{authStatus}</div>
              <button type="button" className="ghost" onClick={() => void loginWithGithub()} disabled={!authConfig?.enabled || Boolean(authConfig.user)}>
                Login with GitHub
              </button>
              <button type="button" className="ghost" onClick={() => void logout()} disabled={!authConfig?.user}>
                Logout
              </button>
            </div>
          </form>
        </section>

        <nav className="tabs" aria-label="Primary">
          {tabs.map((tab) => (
            <button key={tab.id} className={tab.id === activeTab ? "tab active" : "tab"} onClick={() => setActiveTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "quest-center" && (
          <section className="tab-panel active">
            <div className="grid two">
              <article className="card">
                <div className="section-head">
                  <h2>Projects</h2>
                  <button className="ghost" type="button" onClick={() => void refreshProjects()}>
                    Refresh
                  </button>
                </div>
                <div className="stack">
                  {projects.map((project) => (
                    <button key={project.id} className="project-item" type="button" onClick={() => setSelectedProjectId(project.id)}>
                      <span className="title">{project.name}</span>
                      <span className="meta">
                        {project.description || "No description"} · {project.taskStats.running} running / {project.taskStats.failed} failed
                        {project.repository ? " · repo linked" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="card">
                <div className="section-head">
                  <h2>Create</h2>
                </div>
                <form className="stack compact" onSubmit={onCreateProject}>
                  <h3>New project</h3>
                  <input name="name" placeholder="project name" required />
                  <textarea name="description" rows={3} placeholder="goal / scope / notes" />
                  <input name="repository" placeholder="GitHub repo URL (optional)" />
                  <select name="visibility" defaultValue="private">
                    <option value="private">Private GitHub repo</option>
                    <option value="public">Public GitHub repo</option>
                  </select>
                  <label className="check-row">
                    <input type="checkbox" name="autoCreateRepo" />
                    <span>Auto-create GitHub repository</span>
                  </label>
                  <button type="submit">Create project plan</button>
                </form>
                <form className="stack compact" onSubmit={onCreateTask}>
                  <h3>New task</h3>
                  <select name="projectId" defaultValue={projects[0]?.id}>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <select name="type" defaultValue="task">
                    <option value="task">Direct task</option>
                    <option value="composite_task">Fuzzy / composite task</option>
                  </select>
                  <input name="title" placeholder="task title" required />
                  <textarea name="description" rows={4} placeholder="what should Codex do?" required />
                  <button type="submit">Create task</button>
                </form>
              </article>
            </div>

            <div className="grid two">
              <article className="card">
                <div className="section-head">
                  <h2>{selectedProjectId ? `Tasks for ${projects.find((project) => project.id === selectedProjectId)?.name || selectedProjectId}` : "Tasks"}</h2>
                  <button className="ghost" type="button" onClick={() => setSelectedProjectId("")}>
                    Clear filter
                  </button>
                </div>
                <div className="stack">
                  {visibleTasks.length ? (
                    visibleTasks.map((task) => (
                      <button key={task.id} className="task-item" type="button" onClick={() => setSelectedTaskId(task.id)}>
                        <span className="title">{task.title}</span>
                        <span className="meta">
                          {task.projectName} · {task.type}
                        </span>
                        <span className="badge">{task.status}</span>
                      </button>
                    ))
                  ) : (
                    <div className="detail-empty">No tasks yet.</div>
                  )}
                </div>
              </article>

              <article className="card">
                <div className="section-head">
                  <h2>Task details</h2>
                </div>
                {selectedTask ? <TaskDetail task={selectedTask} onMutate={mutateTask} onRespond={respondToTask} /> : <div className="detail-empty">Select a task to inspect logs and summary.</div>}
              </article>
            </div>

            <article className="card">
              <div className="section-head">
                <h2>Pending approvals</h2>
                <button className="ghost" type="button" onClick={() => void refreshApprovals()}>
                  Refresh
                </button>
              </div>
              <div className="stack">
                {approvals.length ? approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} onRespond={respondToTask} onOpenTask={setSelectedTaskId} />) : <div className="detail-empty">No pending approvals.</div>}
              </div>
            </article>
          </section>
        )}

        {activeTab === "tools" && (
          <section className="tab-panel active">
            <article className="card">
              <div className="section-head">
                <h2>Tool Routes</h2>
              </div>
              <div className="stack">
                {tools.map((tool) => (
                  <div key={tool.id} className="tool-item">
                    <div className="title">{tool.name}</div>
                    <div className="meta">{tool.description || "No description"}</div>
                    <a className="meta link" href={tool.route} target="_blank" rel="noreferrer">
                      Open {tool.route}
                    </a>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "usage" && (
          <section className="tab-panel active">
            <article className="card">
              <div className="section-head">
                <h2>Usage Snapshot</h2>
              </div>
              <div className="usage-grid">
                {usage
                  ? [
                      ["Total tasks", usage.totalTasks],
                      ["Active tasks", usage.activeTasks],
                      ["Pending approvals", usage.pendingApprovals],
                      ["Completed", usage.completedTasks],
                      ["Failed", usage.failedTasks],
                      ["Token estimate", usage.estimatedTokens],
                      ["Worker runs", usage.totalRuns],
                      ["Last run", usage.lastRunAt || "n/a"],
                    ].map(([label, value]) => (
                      <div key={label} className="usage-item">
                        <div className="meta">{label}</div>
                        <div className="title">{String(value)}</div>
                      </div>
                    ))
                  : <div className="detail-empty">No usage data.</div>}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function TaskDetail({
  task,
  onMutate,
  onRespond,
}: {
  task: Task;
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
        <div className="meta">Status: {task.status}</div>
      </div>
      <div>{task.description || "No description"}</div>
      {task.planPreview ? (
        <div className="log-item">
          <strong>Plan preview</strong>
          <br />
          {task.planPreview}
        </div>
      ) : null}
      {task.summary ? (
        <div className="log-item">
          <strong>Summary</strong>
          <br />
          {task.summary}
        </div>
      ) : null}
      {task.branchName ? (
        <div className="log-item">
          <strong>Branch</strong>
          <br />
          {task.branchName}
        </div>
      ) : null}
      {task.workspacePath ? (
        <div className="log-item">
          <strong>Workspace</strong>
          <br />
          {task.workspacePath}
        </div>
      ) : null}
      {task.children.length ? (
        <div className="log-item">
          <strong>Child tasks</strong>
          <br />
          {task.children.map((child) => `${child.title} (${child.status})`).join("\n")}
        </div>
      ) : null}
      <div className="action-row">
        {task.status === "waiting_user" ? (
          <>
            <button type="button" className="ghost" onClick={() => void onRespond(task.id, "approve", "")}>
              Approve
            </button>
            <button type="button" className="ghost" onClick={() => void onRespond(task.id, "reject", "")}>
              Reject
            </button>
          </>
        ) : null}
        {task.status === "running" ? (
          <button type="button" className="ghost" onClick={() => void onMutate(task.id, "stop")}>
            Stop
          </button>
        ) : null}
        {task.status === "failed" || task.status === "stopped" ? (
          <button type="button" className="ghost" onClick={() => void onMutate(task.id, "retry")}>
            Retry
          </button>
        ) : null}
      </div>
      <div className="log-list">
        {task.logs.length ? (
          task.logs.map((entry) => (
            <div key={`${entry.timestamp}-${entry.message}`} className="log-item">
              <div className="meta">{new Date(entry.timestamp).toLocaleString()}</div>
              <div>{entry.message}</div>
            </div>
          ))
        ) : (
          <div className="detail-empty">No important logs yet.</div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onRespond,
  onOpenTask,
}: {
  approval: Approval;
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
      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback or constraints" />
      <div className="action-row">
        <button type="button" onClick={() => void onRespond(approval.task.id, "approve", feedback)}>
          Approve
        </button>
        <button type="button" className="ghost" onClick={() => void onRespond(approval.task.id, "reject", feedback)}>
          Reject
        </button>
        <button type="button" className="ghost" onClick={() => onOpenTask(approval.task.id)}>
          Open task
        </button>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

