const DEFAULT_API_BASE = "http://localhost:8787";

const state = {
  apiBase: localStorage.getItem("codex.apiBase") || DEFAULT_API_BASE,
  sessionToken: localStorage.getItem("codex.sessionToken") || "",
  authConfig: null,
  projects: [],
  tasks: [],
  approvals: [],
  selectedTaskId: null,
};

const elements = {
  settingsForm: document.querySelector("#settings-form"),
  apiBase: document.querySelector("#api-base"),
  connectionStatus: document.querySelector("#connection-status"),
  authStatus: document.querySelector("#auth-status"),
  loginButton: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
  projectList: document.querySelector("#project-list"),
  taskList: document.querySelector("#task-list"),
  taskDetail: document.querySelector("#task-detail"),
  approvalList: document.querySelector("#approval-list"),
  taskProjectSelect: document.querySelector("#task-project-select"),
  projectForm: document.querySelector("#project-form"),
  taskForm: document.querySelector("#task-form"),
  toolsList: document.querySelector("#tools-list"),
  usagePanel: document.querySelector("#usage-panel"),
};

elements.apiBase.value = state.apiBase;

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((node) => node.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`)?.classList.add("active");
  });
});

elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.apiBase = elements.apiBase.value.trim() || DEFAULT_API_BASE;
  localStorage.setItem("codex.apiBase", state.apiBase);
  await refreshAll();
});

elements.loginButton.addEventListener("click", () => runGithubDeviceLogin());
elements.logoutButton.addEventListener("click", () => logout());

document.querySelector("#refresh-projects").addEventListener("click", () => refreshProjects());
document.querySelector("#refresh-tasks").addEventListener("click", () => refreshTasks());
document.querySelector("#refresh-approvals").addEventListener("click", () => refreshApprovals());
document.querySelector("#refresh-usage").addEventListener("click", () => refreshUsage());

elements.projectForm.addEventListener("submit", async (event) => {
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
  event.currentTarget.reset();
  await refreshAll();
});

elements.taskForm.addEventListener("submit", async (event) => {
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
  event.currentTarget.reset();
  await refreshTasks();
  await refreshApprovals();
});

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBase}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function refreshHealth() {
  try {
    const payload = await api("/api/health");
    elements.connectionStatus.textContent = `Connected to ${payload.serverName} on ${payload.host}`;
    elements.connectionStatus.className = "hint status-success";
  } catch (error) {
    elements.connectionStatus.textContent = error.message;
    elements.connectionStatus.className = "hint status-danger";
  }
}

async function refreshAuth() {
  try {
    const payload = await api("/api/auth/config");
    state.authConfig = payload;
    if (!payload.enabled) {
      elements.authStatus.textContent = "Auth disabled on server.";
      elements.loginButton.disabled = true;
      elements.logoutButton.disabled = true;
      return;
    }
    if (payload.user) {
      elements.authStatus.textContent = `Authenticated as ${payload.user.login}`;
      elements.loginButton.disabled = true;
      elements.logoutButton.disabled = false;
    } else {
      elements.authStatus.textContent = "Not authenticated.";
      elements.loginButton.disabled = false;
      elements.logoutButton.disabled = true;
    }
  } catch (error) {
    elements.authStatus.textContent = error.message;
  }
}

async function refreshProjects() {
  try {
    const payload = await api("/api/projects");
    state.projects = payload.projects;
    renderProjects();
    renderProjectSelect();
  } catch (error) {
    elements.projectList.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshTasks() {
  try {
    const payload = await api("/api/tasks");
    state.tasks = payload.tasks;
    state.approvals = payload.approvals || [];
    renderTasks();
    renderApprovals();
    if (state.selectedTaskId) {
      await loadTaskDetail(state.selectedTaskId);
    }
  } catch (error) {
    elements.taskList.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
    elements.approvalList.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshApprovals() {
  try {
    const payload = await api("/api/approvals");
    state.approvals = payload.approvals || [];
    renderApprovals();
  } catch (error) {
    elements.approvalList.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshTools() {
  try {
    const payload = await api("/api/tools");
    elements.toolsList.innerHTML = payload.tools
      .map(
        (tool) => `
          <div class="tool-item">
            <div class="title">${escapeHtml(tool.name)}</div>
            <div class="meta">${escapeHtml(tool.description || "No description")}</div>
            <a href="${escapeAttribute(tool.route)}" class="meta" target="_blank" rel="noreferrer">Open ${escapeHtml(tool.route)}</a>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    elements.toolsList.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshUsage() {
  try {
    const payload = await api("/api/usage");
    const cards = [
      ["Total tasks", payload.overview.totalTasks],
      ["Active tasks", payload.overview.activeTasks],
      ["Pending approvals", payload.overview.pendingApprovals],
      ["Completed", payload.overview.completedTasks],
      ["Failed", payload.overview.failedTasks],
      ["Token estimate", payload.overview.estimatedTokens],
      ["Worker runs", payload.overview.totalRuns],
      ["Last run", payload.overview.lastRunAt || "n/a"],
    ];
    elements.usagePanel.innerHTML = cards
      .map(
        ([label, value]) => `
          <div class="usage-item">
            <div class="meta">${escapeHtml(label)}</div>
            <div class="title">${escapeHtml(String(value))}</div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    elements.usagePanel.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderProjects() {
  const template = document.querySelector("#project-template");
  elements.projectList.innerHTML = "";
  state.projects.forEach((project) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".title").textContent = project.name;
    node.querySelector(".meta").textContent =
      `${project.description || "No description"} · ${project.taskStats.running} running / ${project.taskStats.failed} failed${project.repository ? " · repo linked" : ""}`;
    node.addEventListener("click", () => filterTasksForProject(project.id));
    elements.projectList.append(node);
  });
}

function renderProjectSelect() {
  elements.taskProjectSelect.innerHTML = state.projects
    .map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`)
    .join("");
}

function renderTasks(projectId = null) {
  const template = document.querySelector("#task-template");
  elements.taskList.innerHTML = "";
  const tasks = projectId ? state.tasks.filter((task) => task.projectId === projectId) : state.tasks;
  tasks.forEach((task) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".title").textContent = task.title;
    node.querySelector(".meta").textContent = `${task.projectName} · ${task.type}`;
    node.querySelector(".badge").textContent = task.status;
    node.addEventListener("click", () => {
      state.selectedTaskId = task.id;
      loadTaskDetail(task.id);
    });
    elements.taskList.append(node);
  });
  if (!tasks.length) {
    elements.taskList.innerHTML = `<div class="detail-empty">No tasks yet.</div>`;
  }
}

function renderApprovals() {
  if (!state.approvals.length) {
    elements.approvalList.innerHTML = `<div class="detail-empty">No pending approvals.</div>`;
    return;
  }
  elements.approvalList.innerHTML = state.approvals
    .map(
      (approval) => `
        <div class="approval-item">
          <div class="title">${escapeHtml(approval.task.title)}</div>
          <div class="meta">${escapeHtml(approval.reason || "Approval required")}</div>
          <div class="meta">${escapeHtml(approval.task.projectName)} · ${escapeHtml(approval.task.type)}</div>
          <textarea id="feedback-${escapeAttribute(approval.id)}" placeholder="Optional feedback or constraints"></textarea>
          <div class="action-row">
            <button type="button" data-approval="${escapeAttribute(approval.task.id)}" data-decision="approve">Approve</button>
            <button type="button" data-approval="${escapeAttribute(approval.task.id)}" data-decision="reject" class="ghost">Reject</button>
            <button type="button" data-open-task="${escapeAttribute(approval.task.id)}" class="ghost">Open task</button>
          </div>
        </div>
      `,
    )
    .join("");

  document.querySelectorAll("[data-approval]").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.approval;
      const approval = state.approvals.find((item) => item.task.id === taskId);
      const textarea = approval ? document.querySelector(`#feedback-${approval.id}`) : null;
      await respondToTask(taskId, button.dataset.decision, textarea?.value || "");
    });
  });
  document.querySelectorAll("[data-open-task]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTaskId = button.dataset.openTask;
      loadTaskDetail(button.dataset.openTask);
    });
  });
}

function filterTasksForProject(projectId) {
  renderTasks(projectId);
}

async function loadTaskDetail(taskId) {
  try {
    const payload = await api(`/api/tasks/${taskId}`);
    const task = payload.task;
    const logs = task.logs.length
      ? task.logs
          .map(
            (entry) => `
              <div class="log-item">
                <div class="meta">${escapeHtml(new Date(entry.timestamp).toLocaleString())}</div>
                <div>${escapeHtml(entry.message)}</div>
              </div>
            `,
          )
          .join("")
      : `<div class="detail-empty">No important logs yet.</div>`;

    const childList = task.children?.length
      ? `<div class="log-item"><strong>Child tasks</strong><br />${task.children
          .map((child) => `${escapeHtml(child.title)} (${escapeHtml(child.status)})`)
          .join("<br />")}</div>`
      : "";

    const actionButtons = [];
    if (task.status === "waiting_user") {
      actionButtons.push(actionButton("Approve", () => respondToTask(task.id, "approve", "")));
      actionButtons.push(actionButton("Reject", () => respondToTask(task.id, "reject", "")));
    }
    if (task.status === "running") {
      actionButtons.push(actionButton("Stop", () => mutateTask(task.id, "stop")));
    }
    if (task.status === "failed" || task.status === "stopped") {
      actionButtons.push(actionButton("Retry", () => mutateTask(task.id, "retry")));
    }

    elements.taskDetail.innerHTML = `
      <div class="detail-card">
        <div>
          <div class="meta">${escapeHtml(task.projectName)} · ${escapeHtml(task.type)}</div>
          <h3>${escapeHtml(task.title)}</h3>
          <div class="meta">Status: ${escapeHtml(task.status)}</div>
        </div>
        <div>${escapeHtml(task.description || "No description")}</div>
        ${task.planPreview ? `<div class="log-item"><strong>Plan preview</strong><br />${escapeHtml(task.planPreview).replaceAll("\n", "<br />")}</div>` : ""}
        ${task.summary ? `<div class="log-item"><strong>Summary</strong><br />${escapeHtml(task.summary)}</div>` : ""}
        ${task.branchName ? `<div class="log-item"><strong>Branch</strong><br />${escapeHtml(task.branchName)}</div>` : ""}
        ${task.workspacePath ? `<div class="log-item"><strong>Workspace</strong><br />${escapeHtml(task.workspacePath)}</div>` : ""}
        ${childList}
        ${actionButtons.length ? `<div class="action-row">${actionButtons.join("")}</div>` : ""}
        <div class="log-list">${logs}</div>
      </div>
    `;
  } catch (error) {
    elements.taskDetail.innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}

function actionButton(label, handler) {
  const id = `action-${Math.random().toString(16).slice(2)}`;
  queueMicrotask(() => {
    document.querySelector(`#${id}`)?.addEventListener("click", handler);
  });
  return `<button id="${id}" class="ghost">${escapeHtml(label)}</button>`;
}

async function mutateTask(taskId, action) {
  await api(`/api/tasks/${taskId}/${action}`, { method: "POST" });
  await refreshTasks();
  await refreshApprovals();
}

async function respondToTask(taskId, decision, feedback) {
  await api(`/api/tasks/${taskId}/respond`, {
    method: "POST",
    body: JSON.stringify({ decision, feedback }),
  });
  await refreshTasks();
  await refreshApprovals();
  await refreshProjects();
}

async function runGithubDeviceLogin() {
  const config = state.authConfig || (await api("/api/auth/config"));
  if (!config.enabled || config.mode !== "github-device") {
    alert("GitHub device flow is not enabled on the server.");
    return;
  }
  const device = await api("/api/auth/device/start", { method: "POST", body: JSON.stringify({}) });
  alert(`Open ${device.verification_uri} and enter code ${device.user_code}`);
  const startedAt = Date.now();
  while (Date.now() - startedAt < device.expires_in * 1000) {
    await sleep((device.interval || 5) * 1000);
    const polled = await api("/api/auth/device/poll", {
      method: "POST",
      body: JSON.stringify({ deviceCode: device.device_code }),
    });
    if (polled.sessionToken) {
      state.sessionToken = polled.sessionToken;
      localStorage.setItem("codex.sessionToken", state.sessionToken);
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
    state.sessionToken = "";
    localStorage.removeItem("codex.sessionToken");
    await refreshAll();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function refreshAll() {
  await refreshHealth();
  await refreshAuth();
  await Promise.all([refreshProjects(), refreshTasks(), refreshApprovals(), refreshTools(), refreshUsage()]);
}

refreshAll();
setInterval(() => {
  refreshTasks();
  refreshApprovals();
  refreshUsage();
}, 5000);
