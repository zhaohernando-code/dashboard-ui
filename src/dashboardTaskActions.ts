import type { Dispatch, SetStateAction } from "react";

import { AUTO_ROUTE_PROJECT_ID } from "./dashboardConstants";
import type { PendingTaskMutation } from "./dashboardControlTypes";
import { buildTaskLookupKey } from "./dashboardPendingMutations";
import {
  deriveExecutionProfile,
  deriveProjectMetadataDescription,
  deriveRequestedProjectId,
  getProjectDisplayName,
  getTaskProjectId,
} from "./dashboardProjectUtils";
import type {
  CreateDialogMode,
  CreateProjectValues,
  CreateTaskValues,
  Locale,
  NoticeTone,
  Task,
  TaskPendingActionType,
  WorkspaceLevel,
} from "./dashboardTypes";

type DashboardRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type DashboardTaskActionsInput = {
  locale: Locale;
  visibleTasks: Task[];
  tasks: Task[];
  api: DashboardRequest;
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
  } = input;

  async function onCreateProject(values: CreateProjectValues) {
    try {
      const name = String(values.name || "").trim();
      const description = String(values.description || "").trim();
      const projectDescription = deriveProjectMetadataDescription(name, description);
      const repository = String(values.repository || "").trim();
      const visibility = String(values.visibility || "public");
      const autoCreateRepo = Boolean(values.autoCreateRepo);
      const executionProfile = deriveExecutionProfile(values);
      const requestedProjectId = deriveRequestedProjectId(name, repository);

      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: projectDescription,
          repository,
          visibility,
          autoCreateRepo,
          requestedModel: executionProfile.requestedModel,
          model: executionProfile.model,
          reasoningEffort: executionProfile.reasoningEffort,
          fastMode: executionProfile.fastMode,
          speedTier: executionProfile.speedTier,
        }),
      });
      setTransientNotice(locale === "zh-CN" ? "项目已创建" : "Project created", "success");
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
      const executionProfile = deriveExecutionProfile(values);
      const planMode = type === "task" ? Boolean(values.planMode) : false;

      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          type,
          title,
          description,
          requestedModel: executionProfile.requestedModel,
          model: executionProfile.model,
          reasoningEffort: executionProfile.reasoningEffort,
          planMode,
          fastMode: executionProfile.fastMode,
          speedTier: executionProfile.speedTier,
        }),
      });

      const pendingSummary = locale === "zh-CN" ? "任务请求已提交，等待系统捕获。" : "The task request was submitted. Waiting for the system to capture it.";
      const createdTask: Task = {
        id: `pending-local-${Date.now().toString(36)}`,
        updatedAt: new Date().toISOString(),
        projectId,
        projectName: getProjectDisplayName(projectId, locale),
        type,
        title,
        description,
        model: executionProfile.model,
        requestedModel: executionProfile.requestedModel,
        reasoningEffort: executionProfile.reasoningEffort,
        planMode,
        fastMode: executionProfile.fastMode,
        speedTier: executionProfile.speedTier,
        status: "pending",
        summary: pendingSummary,
        userSummary: pendingSummary,
        planPreview: "",
        workspacePath: "",
        branchName: "",
        logs: [],
        children: [],
      };
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
      setSelectedProjectId(projectId);
      setSelectedTaskId(createdTask.id);
      setWorkspaceLevel("tasks");
      setCreateDialogMode(null);
      startExpeditedTaskPolling();
      await refreshTasks();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function mutateTask(taskId: string, action: "cancel" | "retry") {
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
      await api(`/api/tasks/${taskId}/${action}`, { method: "POST" });
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
        action === "cancel" ? (locale === "zh-CN" ? "已提交取消请求" : "Cancel requested") : locale === "zh-CN" ? "已提交继续处理" : "Retry requested",
        "success",
      );
      await refreshTasks();
      await refreshApprovals();
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
      await api(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision, feedback, finalize: decision === "approve" }),
      });
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
      await refreshApprovals();
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
