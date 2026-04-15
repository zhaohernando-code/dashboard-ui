import type { Dispatch, SetStateAction } from "react";

import { AUTO_ROUTE_PROJECT_ID, GITHUB_TASK_REPO } from "./dashboardConstants";
import type { PendingTaskMutation } from "./dashboardControlTypes";
import { buildTaskLookupKey } from "./dashboardPendingMutations";
import {
  deriveProjectMetadataDescription,
  deriveRequestedProjectId,
  getProjectDisplayName,
  getTaskProjectId,
  normalizeRequestedModel,
  normalizeRequestedReasoningEffort,
} from "./dashboardProjectUtils";
import type {
  AuthConfig,
  CreateDialogMode,
  CreateProjectValues,
  CreateTaskValues,
  IssueTask,
  Locale,
  NoticeTone,
  RuntimeMode,
  Task,
  TaskPendingActionType,
  WorkspaceLevel,
} from "./dashboardTypes";

type DashboardRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type DashboardTaskActionsInput = {
  locale: Locale;
  runtimeMode: RuntimeMode;
  authConfig: AuthConfig | null;
  visibleTasks: Task[];
  tasks: Task[];
  api: DashboardRequest;
  githubRequest: DashboardRequest;
  setPendingTaskMutations: Dispatch<SetStateAction<Record<string, PendingTaskMutation>>>;
  setSelectedProjectId: (next: string) => void;
  setSelectedTaskId: (next: string) => void;
  setWorkspaceLevel: (next: WorkspaceLevel) => void;
  setCreateDialogMode: (next: CreateDialogMode | null) => void;
  setTransientNotice: (message: string, tone?: NoticeTone) => void;
  startExpeditedTaskPolling: () => void;
  refreshAll: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshApprovals: () => Promise<void>;
  summarizeError: (error: unknown) => string;
};

export function createDashboardTaskActions(input: DashboardTaskActionsInput) {
  const {
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
  } = input;

  async function onCreateProject(values: CreateProjectValues) {
    try {
      const name = String(values.name || "").trim();
      const description = String(values.description || "").trim();
      const projectDescription = deriveProjectMetadataDescription(name, description);
      const repository = String(values.repository || "").trim();
      const visibility = String(values.visibility || "public");
      const autoCreateRepo = Boolean(values.autoCreateRepo);
      const model = normalizeRequestedModel(String(values.model || ""));
      const reasoningEffort = normalizeRequestedReasoningEffort(String(values.reasoningEffort || ""));
      const requestedProjectId = deriveRequestedProjectId(name, repository);
      const requestedProject = {
        id: requestedProjectId,
        name,
        description: projectDescription,
        repository,
        visibility,
        autoCreateRepo,
      };
      const title = `Create project: ${name}`;
      const taskDescription = description || `Create a new Codex-managed project named ${name}.`;

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = {
          projectId: requestedProjectId,
          type: "project_create",
          title,
          description: taskDescription,
          model,
          reasoningEffort,
          requestedProject,
        };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            body: [
              `project: ${payload.projectId}`,
              `type: ${payload.type}`,
              `model: ${payload.model}`,
              `reasoning: ${payload.reasoningEffort === "medium" ? "normal" : payload.reasoningEffort}`,
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
        const acceptedAt = new Date().toISOString();
        const createdPlaceholder: Task = {
          id: `pending-issue-${issue.number}`,
          updatedAt: acceptedAt,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          projectId: requestedProjectId,
          projectName: name || getProjectDisplayName(requestedProjectId, locale),
          requestedProject,
          type: "project_create",
          title,
          description: taskDescription,
          model,
          reasoningEffort,
          status: "pending_capture",
          summary: "",
          userSummary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        setPendingTaskMutations((current) => ({
          ...current,
          [createdPlaceholder.id]: {
            taskId: createdPlaceholder.id,
            issueNumber: issue.number,
            lookupKey: buildTaskLookupKey(createdPlaceholder),
            actionType: "create_project",
            phase: "waiting_remote",
            startedAt: acceptedAt,
            acceptedAt,
            timeoutAt: new Date(Date.now() + 45_000).toISOString(),
            placeholderTask: createdPlaceholder,
          },
        }));
        setTransientNotice(
          locale === "zh-CN" ? `项目请求已入队：Issue #${issue.number}` : `Project queued via issue #${issue.number}`,
          "success",
        );
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId: requestedProjectId,
            type: "project_create",
            title,
            description: taskDescription,
            model,
            reasoningEffort,
            requestedProject,
          }),
        });
        const acceptedAt = new Date().toISOString();
        const createdPlaceholder: Task = {
          id: `pending-issue-${queued.issue.number}`,
          updatedAt: acceptedAt,
          issueNumber: queued.issue.number,
          issueUrl: queued.issue.url,
          projectId: requestedProjectId,
          projectName: name || getProjectDisplayName(requestedProjectId, locale),
          requestedProject,
          type: "project_create",
          title,
          description: taskDescription,
          model,
          reasoningEffort,
          status: "pending_capture",
          summary: "",
          userSummary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        setPendingTaskMutations((current) => ({
          ...current,
          [createdPlaceholder.id]: {
            taskId: createdPlaceholder.id,
            issueNumber: queued.issue.number,
            lookupKey: buildTaskLookupKey(createdPlaceholder),
            actionType: "create_project",
            phase: "waiting_remote",
            startedAt: acceptedAt,
            acceptedAt,
            timeoutAt: new Date(Date.now() + 45_000).toISOString(),
            placeholderTask: createdPlaceholder,
          },
        }));
        setTransientNotice(
          locale === "zh-CN"
            ? `项目请求已入队：Issue #${queued.issue.number}`
            : `Project queued via issue #${queued.issue.number}`,
          "success",
        );
      } else {
        await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: projectDescription,
            repository,
            visibility,
            autoCreateRepo,
            model,
            reasoningEffort,
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "项目已创建" : "Project created", "success");
      }
      setSelectedProjectId(requestedProjectId);
      setCreateDialogMode(null);
      startExpeditedTaskPolling();
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function onCreateTask(values: CreateTaskValues) {
    try {
      const type = String(values.type || "task").trim();
      const projectId = getTaskProjectId(type, String(values.projectId || "").trim());
      const title = String(values.title || "").trim();
      const description = String(values.description || "").trim();
      const model = normalizeRequestedModel(String(values.model || ""));
      const reasoningEffort = normalizeRequestedReasoningEffort(String(values.reasoningEffort || ""));
      const planMode = type === "task" ? Boolean(values.planMode) : false;
      let createdTaskId = "";

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = { projectId, type, title, description, model, reasoningEffort, planMode };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body: [
              `project: ${projectId}`,
              `type: ${type}`,
              `model: ${model}`,
              `reasoning: ${reasoningEffort === "medium" ? "normal" : reasoningEffort}`,
              ...(planMode ? ["plan_mode: true"] : []),
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
        const createdTask: Task = {
          id: `pending-issue-${issue.number}`,
          updatedAt: new Date().toISOString(),
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          projectId,
          projectName: getProjectDisplayName(projectId, locale),
          type,
          title,
          description,
          model,
          reasoningEffort,
          planMode,
          status: "pending_capture",
          summary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        createdTaskId = createdTask.id;
        setPendingTaskMutations((current) => ({
          ...current,
          [createdTask.id]: {
            taskId: createdTask.id,
            issueNumber: issue.number,
            lookupKey: buildTaskLookupKey(createdTask),
            actionType: "create_task",
            phase: "waiting_remote",
            startedAt: createdTask.updatedAt || new Date().toISOString(),
            acceptedAt: createdTask.updatedAt || new Date().toISOString(),
            timeoutAt: new Date(Date.now() + 45_000).toISOString(),
            placeholderTask: createdTask,
          },
        }));
        setTransientNotice(locale === "zh-CN" ? `任务已入队：Issue #${issue.number}` : `Task queued via issue #${issue.number}`, "success");
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            type,
            title,
            description,
            model,
            reasoningEffort,
            planMode,
          }),
        });
        const createdTask: Task = {
          id: `pending-issue-${queued.issue.number}`,
          updatedAt: new Date().toISOString(),
          issueNumber: queued.issue.number,
          issueUrl: queued.issue.url,
          projectId,
          projectName: getProjectDisplayName(projectId, locale),
          type,
          title,
          description,
          model,
          reasoningEffort,
          planMode,
          status: "pending_capture",
          summary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        createdTaskId = createdTask.id;
        setPendingTaskMutations((current) => ({
          ...current,
          [createdTask.id]: {
            taskId: createdTask.id,
            issueNumber: queued.issue.number,
            lookupKey: buildTaskLookupKey(createdTask),
            actionType: "create_task",
            phase: "waiting_remote",
            startedAt: createdTask.updatedAt || new Date().toISOString(),
            acceptedAt: createdTask.updatedAt || new Date().toISOString(),
            timeoutAt: new Date(Date.now() + 45_000).toISOString(),
            placeholderTask: createdTask,
          },
        }));
        setTransientNotice(
          locale === "zh-CN"
            ? `任务已入队：Issue #${queued.issue.number}`
            : `Task queued via issue #${queued.issue.number}`,
          "success",
        );
      } else {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            type,
            title,
            description,
            model,
            reasoningEffort,
            planMode,
          }),
        });
        const createdTask: Task = {
          id: `pending-local-${Date.now().toString(36)}`,
          updatedAt: new Date().toISOString(),
          projectId,
          projectName: getProjectDisplayName(projectId, locale),
          type,
          title,
          description,
          model,
          reasoningEffort,
          planMode,
          status: "pending_capture",
          summary: "",
          userSummary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        createdTaskId = createdTask.id;
        setPendingTaskMutations((current) => ({
          ...current,
          [createdTask.id]: {
            taskId: createdTask.id,
            lookupKey: buildTaskLookupKey(createdTask),
            actionType: "create_task",
            phase: "waiting_remote",
            startedAt: createdTask.updatedAt || new Date().toISOString(),
            acceptedAt: createdTask.updatedAt || new Date().toISOString(),
            timeoutAt: new Date(Date.now() + 45_000).toISOString(),
            placeholderTask: createdTask,
          },
        }));
        setTransientNotice(locale === "zh-CN" ? "任务已创建" : "Task created", "success");
      }
      if (createdTaskId) {
        setSelectedProjectId(projectId);
        setSelectedTaskId(createdTaskId);
        setWorkspaceLevel("tasks");
      }
      setCreateDialogMode(null);
      startExpeditedTaskPolling();
      await refreshTasks();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function mutateTask(taskId: string, action: "stop" | "retry") {
    const task = visibleTasks.find((item) => item.id === taskId) || tasks.find((item) => item.id === taskId);
    if (!task) {
      setTransientNotice(locale === "zh-CN" ? "未找到对应任务" : "Task not found", "error");
      return;
    }
    const startedAt = new Date().toISOString();
    setPendingTaskMutations((current) => ({
      ...current,
      [taskId]: {
        taskId,
        issueNumber: task.issueNumber,
        lookupKey: buildTaskLookupKey(task),
        actionType: action,
        phase: "submitting",
        startedAt,
        baseStatus: task.status,
        baseUpdatedAt: task.updatedAt,
        baseLastStatusCommentAt: task.lastStatusCommentAt,
        taskType: task.type,
        executionMode: task.executionMode,
        executionGate: Boolean(task.executionDecisionGate),
        resumeEligible: Boolean(task.resumeEligible),
      },
    }));
    try {
      if (runtimeMode === "github-direct") {
        if (!task.issueNumber) {
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
      const acceptedAt = new Date().toISOString();
      setPendingTaskMutations((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] || {
            taskId,
            issueNumber: task.issueNumber,
            lookupKey: buildTaskLookupKey(task),
            actionType: action,
            startedAt,
          }),
          phase: "waiting_remote",
          acceptedAt,
          timeoutAt: new Date(Date.now() + 45_000).toISOString(),
          baseStatus: task.status,
          baseUpdatedAt: task.updatedAt,
          baseLastStatusCommentAt: task.lastStatusCommentAt,
          taskType: task.type,
          executionMode: task.executionMode,
          executionGate: Boolean(task.executionDecisionGate),
          resumeEligible: Boolean(task.resumeEligible),
        },
      }));
      startExpeditedTaskPolling();
      setTransientNotice(
        action === "stop" ? (locale === "zh-CN" ? "已发送停止指令" : "Stop requested") : locale === "zh-CN" ? "已重试任务" : "Task retried",
        "success",
      );
      await refreshTasks();
      if (runtimeMode !== "github-direct") {
        await refreshApprovals();
      }
    } catch (error) {
      setPendingTaskMutations((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function respondToTask(taskId: string, decision: "approve" | "reject" | "feedback", feedback: string): Promise<boolean> {
    const task = visibleTasks.find((item) => item.id === taskId) || tasks.find((item) => item.id === taskId);
    if (!task) {
      setTransientNotice(locale === "zh-CN" ? "未找到对应任务" : "Task not found", "error");
      return false;
    }
    const startedAt = new Date().toISOString();
    const actionType: TaskPendingActionType = decision === "feedback" ? "feedback" : decision;
    setPendingTaskMutations((current) => ({
      ...current,
      [taskId]: {
        taskId,
        issueNumber: task.issueNumber,
        lookupKey: buildTaskLookupKey(task),
        actionType,
        phase: "submitting",
        startedAt,
        baseStatus: task.status,
        baseUpdatedAt: task.updatedAt,
        baseLastStatusCommentAt: task.lastStatusCommentAt,
        basePlanPreview: task.planPreview,
        taskType: task.type,
        executionMode: task.executionMode,
        executionGate: Boolean(task.executionDecisionGate),
        resumeEligible: Boolean(task.resumeEligible),
      },
    }));
    try {
      if (runtimeMode === "github-direct") {
        if (!task.issueNumber) {
          throw new Error(locale === "zh-CN" ? "当前任务没有对应的 Issue 编号" : "This task is missing an issue number");
        }
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const command = decision === "feedback"
          ? `/feedback ${feedback}`.trim()
          : decision === "approve"
            ? `/approve ${feedback}`.trim()
            : `/reject ${feedback}`.trim();
        await githubRequest(`/repos/${owner}/${repoName}/issues/${task.issueNumber}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: command }),
        });
      } else {
        await api(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          body: JSON.stringify({ decision, feedback, finalize: decision === "approve" }),
        });
      }
      const acceptedAt = new Date().toISOString();
      setPendingTaskMutations((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] || {
            taskId,
            issueNumber: task.issueNumber,
            lookupKey: buildTaskLookupKey(task),
            actionType,
            startedAt,
          }),
          phase: "waiting_remote",
          acceptedAt,
          timeoutAt: new Date(Date.now() + 45_000).toISOString(),
          baseStatus: task.status,
          baseUpdatedAt: task.updatedAt,
          baseLastStatusCommentAt: task.lastStatusCommentAt,
          basePlanPreview: task.planPreview,
          taskType: task.type,
          executionMode: task.executionMode,
          executionGate: Boolean(task.executionDecisionGate),
          resumeEligible: Boolean(task.resumeEligible),
        },
      }));
      startExpeditedTaskPolling();
      setTransientNotice(
        decision === "feedback"
          ? (locale === "zh-CN" ? "反馈已提交，正在更新计划" : "Feedback submitted. Updating plan.")
          : locale === "zh-CN"
            ? "审批结果已提交"
            : "Decision submitted",
        "success",
      );
      await refreshTasks();
      if (runtimeMode !== "github-direct") {
        await refreshApprovals();
      }
      return true;
    } catch (error) {
      setPendingTaskMutations((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
      setTransientNotice(summarizeError(error), "error");
      return false;
    }
  }

  return {
    onCreateProject,
    onCreateTask,
    mutateTask,
    respondToTask,
  };
}
