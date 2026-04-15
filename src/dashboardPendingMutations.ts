import { statusLabel, statusTagColor } from "./dashboardConstants";
import type { PendingTaskMutation, TaskStatusDisplayState } from "./dashboardControlTypes";
import type { Locale, Task, TaskPendingAction } from "./dashboardTypes";

export function buildTaskLookupKey(task: Pick<Task, "projectId" | "type" | "title" | "description">) {
  return [
    String(task.projectId || "").trim(),
    String(task.type || "").trim(),
    String(task.title || "").trim(),
    String(task.description || "").trim(),
  ].join("::");
}

export function taskNeedsUserAttention(task: Pick<Task, "status" | "pendingAction">) {
  return task.status === "waiting_user" && !task.pendingAction?.hideFromApprovals;
}

function getPendingTaskMutationCopy(
  mutation: Pick<PendingTaskMutation, "actionType" | "phase" | "baseStatus" | "executionMode" | "executionGate" | "resumeEligible">,
  locale: Locale,
) {
  const delayed = mutation.phase === "timed_out";
  const submitting = mutation.phase === "submitting";
  const createCopy = mutation.actionType === "create_project"
    ? {
        label: locale === "zh-CN"
          ? (submitting ? "提交项目请求中" : delayed ? "项目同步较慢" : "项目已入队")
          : (submitting ? "Submitting project" : delayed ? "Project sync delayed" : "Project queued"),
        message: locale === "zh-CN"
          ? (delayed
              ? "项目请求已提交，但系统回执较慢。你可以先刷新页面确认最新状态。"
              : "项目请求已提交，等待系统捕获并生成规划。")
          : (delayed
              ? "The project request was submitted, but remote sync is taking longer than expected. Refresh to confirm the latest state."
              : "The project request was submitted. Waiting for the system to capture it and generate a plan."),
      }
    : {
        label: locale === "zh-CN"
          ? (submitting ? "提交任务中" : delayed ? "任务同步较慢" : "任务已入队")
          : (submitting ? "Submitting task" : delayed ? "Task sync delayed" : "Task queued"),
        message: locale === "zh-CN"
          ? (delayed
              ? "任务请求已提交，但系统回执较慢。你可以先刷新页面确认最新状态。"
              : "任务请求已提交，等待系统捕获。")
          : (delayed
              ? "The task request was submitted, but remote sync is taking longer than expected. Refresh to confirm the latest state."
              : "The task request was submitted. Waiting for the system to capture it."),
      };

  switch (mutation.actionType) {
    case "create_project":
    case "create_task":
      return createCopy;
    case "feedback":
      return {
        label: locale === "zh-CN"
          ? (submitting ? "提交反馈中" : delayed ? "继续规划较慢" : "继续规划中")
          : (submitting ? "Submitting feedback" : delayed ? "Planning delayed" : "Planning"),
        message: locale === "zh-CN"
          ? (delayed
              ? "反馈已提交，但下一版计划同步较慢。请先不要重复提交或开始执行。"
              : "反馈已提交，系统正在根据最新内容自动生成下一版计划。")
          : (delayed
              ? "Feedback was submitted, but the next plan draft is syncing slowly. Do not resubmit or start execution yet."
              : "Feedback was submitted. The system is generating the next plan draft from your latest input."),
      };
    case "approve":
      if (mutation.executionGate) {
        return {
          label: locale === "zh-CN"
            ? (submitting ? "提交决策中" : delayed ? "继续执行较慢" : "继续执行中")
            : (submitting ? "Submitting decision" : delayed ? "Resume delayed" : "Continuing"),
          message: locale === "zh-CN"
            ? (delayed
                ? "当前决策已提交，但项目流恢复较慢。请先不要重复提交。"
                : "当前决策已提交，项目流会继续执行下一步。")
            : (delayed
                ? "The decision was submitted, but resuming the project flow is syncing slowly. Do not submit again yet."
                : "The decision was submitted. The project flow will continue with the next step."),
        };
      }
      if (mutation.baseStatus === "awaiting_acceptance") {
        return {
          label: locale === "zh-CN"
            ? (submitting ? "提交验收中" : delayed ? "验收同步较慢" : "验收处理中")
            : (submitting ? "Submitting acceptance" : delayed ? "Acceptance delayed" : "Accepting"),
          message: locale === "zh-CN"
            ? (delayed
                ? "验收结果已提交，但系统同步较慢。请先不要重复提交。"
                : "验收结果已提交，等待系统同步任务状态。")
            : (delayed
                ? "Acceptance was submitted, but remote sync is taking longer than expected. Do not resubmit yet."
                : "Acceptance was submitted. Waiting for the system to sync the task status."),
        };
      }
      return {
        label: locale === "zh-CN"
          ? (submitting ? "确认计划中" : delayed ? "启动执行较慢" : "启动执行中")
          : (submitting ? "Confirming plan" : delayed ? "Execution start delayed" : "Starting"),
        message: locale === "zh-CN"
          ? (delayed
              ? "计划已确认，但系统开始执行的回执较慢。请先不要重复点击。"
              : "计划已确认，等待系统开始执行。")
          : (delayed
              ? "The plan was confirmed, but execution start is syncing slowly. Do not click again yet."
              : "The plan was confirmed. Waiting for the system to start execution."),
      };
    case "reject":
      if (mutation.baseStatus === "awaiting_acceptance") {
        return {
          label: locale === "zh-CN"
            ? (submitting ? "提交返修中" : delayed ? "返修同步较慢" : "返修处理中")
            : (submitting ? "Submitting revision" : delayed ? "Revision delayed" : "Returning for revision"),
          message: locale === "zh-CN"
            ? (delayed
                ? "返修要求已提交，但系统同步较慢。请先不要重复提交。"
                : "返修要求已提交，等待系统同步任务状态。")
            : (delayed
                ? "The revision request was submitted, but remote sync is taking longer than expected. Do not resubmit yet."
                : "The revision request was submitted. Waiting for the system to sync the task status."),
        };
      }
      return {
        label: locale === "zh-CN"
          ? (submitting ? "提交拒绝中" : delayed ? "拒绝同步较慢" : "拒绝处理中")
          : (submitting ? "Submitting rejection" : delayed ? "Rejection delayed" : "Rejecting"),
        message: locale === "zh-CN"
          ? (delayed
              ? "拒绝意见已提交，但系统同步较慢。请先不要重复提交。"
              : "拒绝意见已提交，等待系统同步任务状态。")
          : (delayed
              ? "The rejection was submitted, but remote sync is taking longer than expected. Do not resubmit yet."
              : "The rejection was submitted. Waiting for the system to sync the task status."),
      };
    case "retry":
      if (mutation.executionMode === "orchestrated" && mutation.resumeEligible) {
        return {
          label: locale === "zh-CN"
            ? (submitting ? "提交恢复中" : delayed ? "恢复同步较慢" : "恢复执行中")
            : (submitting ? "Submitting resume" : delayed ? "Resume delayed" : "Resuming"),
          message: locale === "zh-CN"
            ? (delayed
                ? "恢复指令已提交，但项目流恢复较慢。请先不要重复点击。"
                : "恢复指令已提交，系统会从当前步骤继续执行。")
            : (delayed
                ? "The resume request was submitted, but the project flow is syncing slowly. Do not click again yet."
                : "The resume request was submitted. The system will continue from the current project step."),
        };
      }
      return {
        label: locale === "zh-CN"
          ? (submitting ? "提交重试中" : delayed ? "重试同步较慢" : "重试中")
          : (submitting ? "Submitting retry" : delayed ? "Retry delayed" : "Retrying"),
        message: locale === "zh-CN"
          ? (delayed
              ? "重试指令已提交，但系统重新排队较慢。请先不要重复点击。"
              : "重试指令已提交，等待系统重新排队。")
          : (delayed
              ? "The retry request was submitted, but requeueing is taking longer than expected. Do not click again yet."
              : "The retry request was submitted. Waiting for the system to requeue the task."),
      };
    case "stop":
      return {
        label: locale === "zh-CN"
          ? (submitting ? "提交停止中" : delayed ? "停止同步较慢" : "停止中")
          : (submitting ? "Submitting stop" : delayed ? "Stop delayed" : "Stopping"),
        message: locale === "zh-CN"
          ? (delayed
              ? "停止指令已提交，但系统停止较慢。请先不要重复点击。"
              : "停止指令已提交，等待系统停止任务。")
          : (delayed
              ? "The stop request was submitted, but stopping is taking longer than expected. Do not click again yet."
              : "The stop request was submitted. Waiting for the system to stop the task."),
      };
    default:
      return {
        label: locale === "zh-CN" ? "处理中" : "Processing",
        message: locale === "zh-CN" ? "操作已提交，等待系统同步。" : "The action was submitted. Waiting for the system to sync it.",
      };
  }
}

function buildTaskPendingAction(mutation: PendingTaskMutation, locale: Locale): TaskPendingAction {
  const copy = getPendingTaskMutationCopy(mutation, locale);
  return {
    type: mutation.actionType,
    phase: mutation.phase,
    startedAt: mutation.acceptedAt || mutation.startedAt,
    label: copy.label,
    message: copy.message,
    blocksActions: true,
    hideFromApprovals: ["feedback", "approve", "reject"].includes(mutation.actionType),
  };
}

function applyPendingMutationToTask(task: Task, mutation: PendingTaskMutation, locale: Locale) {
  const pendingAction = buildTaskPendingAction(mutation, locale);
  const nextUpdatedAt = mutation.acceptedAt || mutation.startedAt || task.updatedAt;
  const nextSummary = pendingAction.message;
  return {
    ...task,
    updatedAt: nextUpdatedAt,
    summary: nextSummary,
    userSummary: nextSummary,
    planDraftPending: mutation.actionType === "feedback" ? true : Boolean(task.planDraftPending),
    pendingAction,
  } satisfies Task;
}

export function applyPendingMutationsToTasks(taskList: Task[], pendingMutations: Record<string, PendingTaskMutation>, locale: Locale) {
  if (!Object.keys(pendingMutations).length) {
    return taskList;
  }
  const byTaskId = new Map(Object.values(pendingMutations).map((mutation) => [mutation.taskId, mutation]));
  const byIssueNumber = new Map(
    Object.values(pendingMutations)
      .filter((mutation) => typeof mutation.issueNumber === "number")
      .map((mutation) => [mutation.issueNumber as number, mutation]),
  );
  return taskList.map((task) => {
    const mutation = byTaskId.get(task.id) || (typeof task.issueNumber === "number" ? byIssueNumber.get(task.issueNumber) : undefined);
    return mutation ? applyPendingMutationToTask(task, mutation, locale) : task;
  });
}

export function buildPendingPlaceholderTasks(pendingMutations: Record<string, PendingTaskMutation>, locale: Locale) {
  return Object.values(pendingMutations)
    .filter((mutation) => mutation.placeholderTask)
    .map((mutation) => applyPendingMutationToTask(mutation.placeholderTask as Task, mutation, locale));
}

function hasStatusCommentAfter(task: Pick<Task, "lastStatusCommentAt">, timestamp: string | undefined) {
  const lastStatusCommentAt = Date.parse(task.lastStatusCommentAt || "");
  const compareTo = Date.parse(timestamp || "");
  return Number.isFinite(lastStatusCommentAt) && Number.isFinite(compareTo) && lastStatusCommentAt > compareTo;
}

function hasPendingMutationBeenAcknowledged(task: Task, mutation: PendingTaskMutation) {
  if (mutation.actionType === "create_project" || mutation.actionType === "create_task") {
    return true;
  }
  if (hasStatusCommentAfter(task, mutation.acceptedAt || mutation.startedAt)) {
    return true;
  }
  if (mutation.baseStatus && task.status !== mutation.baseStatus) {
    return true;
  }
  if (mutation.actionType === "feedback") {
    const nextPlanPreview = String(task.planPreview || "").trim();
    return Boolean(nextPlanPreview && nextPlanPreview !== String(mutation.basePlanPreview || "").trim() && !task.planDraftPending);
  }
  return false;
}

export function reconcilePendingTaskMutations(taskList: Task[], pendingMutations: Record<string, PendingTaskMutation>) {
  if (!Object.keys(pendingMutations).length) {
    return pendingMutations;
  }
  const now = Date.now();
  const taskByIssueNumber = new Map(
    taskList
      .filter((task) => typeof task.issueNumber === "number")
      .map((task) => [task.issueNumber as number, task]),
  );
  const taskByLookupKey = new Map(taskList.map((task) => [buildTaskLookupKey(task), task]));
  const next: Record<string, PendingTaskMutation> = {};
  for (const [key, mutation] of Object.entries(pendingMutations)) {
    const remoteTask =
      taskList.find((task) => task.id === mutation.taskId)
      || (typeof mutation.issueNumber === "number" ? taskByIssueNumber.get(mutation.issueNumber) : undefined)
      || taskByLookupKey.get(mutation.lookupKey);
    if (remoteTask && hasPendingMutationBeenAcknowledged(remoteTask, mutation)) {
      continue;
    }
    const timeoutAt = Date.parse(mutation.timeoutAt || "");
    next[key] = Number.isFinite(timeoutAt) && timeoutAt <= now && mutation.phase !== "timed_out"
      ? { ...mutation, phase: "timed_out" }
      : mutation;
  }
  return next;
}

export function getTaskDisplayedStatusText(task: TaskStatusDisplayState, locale: Locale) {
  if (task.executionDecisionGate && task.status === "waiting_user") {
    return locale === "zh-CN" ? "待你决策" : "Decision needed";
  }
  if (task.pendingAction?.label) {
    return task.pendingAction.label;
  }
  if (task.planDraftPending && task.status === "waiting_user") {
    return locale === "zh-CN" ? "继续规划中" : "Planning";
  }
  return statusLabel[task.status][locale];
}

export function getTaskDisplayedStatusColor(task: TaskStatusDisplayState) {
  if (task.pendingAction) {
    return task.pendingAction.phase === "timed_out" ? "warning" : "processing";
  }
  if (task.planDraftPending && task.status === "waiting_user") {
    return "processing";
  }
  return statusTagColor[task.status];
}
