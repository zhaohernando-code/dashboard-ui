import type { Locale, Task, TaskPendingReason, TaskQueueItem, TaskStatus } from "./dashboardTypes";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "pending",
  "running",
  "awaiting_acceptance",
  "waiting",
  "succeeded",
  "cancelled",
];

export const ARCHIVED_TASK_STATUSES = new Set<TaskStatus>(["succeeded", "cancelled"]);

const TASK_PENDING_REASONS = new Set<TaskPendingReason>([
  "plan_feedback",
  "manual_intervention",
  "user_decision",
]);

export function getTaskDisplayStatus(task: Pick<Task, "status" | "pendingReason" | "publishVerified" | "publishStatus">): TaskStatus {
  switch (task.status) {
    case "pending":
    case "pending_capture":
      return "pending";
    case "running":
      return "running";
    case "awaiting_acceptance":
    case "implemented":
      return "awaiting_acceptance";
    case "succeeded":
    case "completed":
      return "succeeded";
    case "cancelled":
    case "superseded":
      return "cancelled";
    case "waiting":
      return "waiting";
    case "blocked":
    case "waiting_user":
    case "needs_revision":
    case "publish_failed":
    case "failed":
    case "stopped":
      return "waiting";
    default:
      return "pending";
  }
}

export function isArchivedTaskStatus(status: TaskStatus) {
  return ARCHIVED_TASK_STATUSES.has(status);
}

export function isArchivedTask(task: Pick<Task, "status">) {
  return isArchivedTaskStatus(getTaskDisplayStatus(task));
}

export function taskNeedsUserAttention(task: Pick<Task, "status" | "pendingAction" | "pendingReason" | "userAction" | "executionDecisionGate" | "planPreview">) {
  return getTaskDisplayStatus(task) === "waiting" && getTaskPendingReason(task) !== "manual_intervention" && !task.pendingAction?.hideFromApprovals;
}

export function getTaskPendingReason(task: Pick<Task, "status" | "pendingReason" | "userAction" | "executionDecisionGate" | "planPreview">) {
  if (getTaskDisplayStatus(task) !== "waiting") {
    return null;
  }

  const explicit = String(task.pendingReason || "").trim() as TaskPendingReason;
  if (explicit === "execution_blocked") {
    return "manual_intervention";
  }
  if (TASK_PENDING_REASONS.has(explicit)) {
    return explicit;
  }

  const actionType = String(task.userAction?.type || "").trim() as TaskPendingReason;
  if (TASK_PENDING_REASONS.has(actionType)) {
    return actionType;
  }

  if (task.executionDecisionGate) {
    return "user_decision";
  }

  if (String(task.planPreview || "").trim()) {
    return "plan_feedback";
  }

  return "manual_intervention";
}

export function getTaskPendingReasonLabel(task: Pick<Task, "pendingReasonLabel" | "userAction" | "status" | "pendingReason" | "executionDecisionGate" | "planPreview">, locale: Locale) {
  const customLabel = String(task.pendingReasonLabel || task.userAction?.title || "").trim();
  if (customLabel) {
    return customLabel;
  }

  switch (getTaskPendingReason(task)) {
    case "plan_feedback":
      return locale === "zh-CN" ? "计划待反馈" : "Plan feedback";
    case "manual_intervention":
      return locale === "zh-CN" ? "人工介入" : "Manual intervention";
    case "user_decision":
      return locale === "zh-CN" ? "需用户拍板" : "User decision";
    default:
      return locale === "zh-CN" ? "待处理" : "Pending";
  }
}

export function canCancelTask(task: Pick<Task, "status" | "pendingAction">) {
  return !isArchivedTask(task) && task.pendingAction?.type !== "cancel";
}

export function getRetryActionLabel(task: Pick<Task, "resumeEligible">, locale: Locale) {
  return task.resumeEligible
    ? (locale === "zh-CN" ? "继续处理" : "Continue")
    : locale === "zh-CN" ? "重试" : "Retry";
}

function toTimestamp(value: string | undefined) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQueueSortValue(task: Pick<Task, "status" | "queuePosition" | "queueEnteredAt" | "updatedAt" | "issueNumber">) {
  if (typeof task.queuePosition === "number" && Number.isFinite(task.queuePosition)) {
    return task.queuePosition;
  }
  const queuedAt = toTimestamp(task.queueEnteredAt);
  if (queuedAt) {
    return queuedAt;
  }
  const updatedAt = toTimestamp(task.updatedAt);
  if (updatedAt) {
    return updatedAt;
  }
  return typeof task.issueNumber === "number" ? task.issueNumber : Number.MAX_SAFE_INTEGER;
}

export function buildTaskQueueItems(tasks: Task[]): TaskQueueItem[] {
  const queueTasks = tasks
    .filter((task) => getTaskDisplayStatus(task) === "pending" || getTaskDisplayStatus(task) === "running" || typeof task.queuePosition === "number")
    .slice()
    .sort((left, right) => {
      if (getTaskDisplayStatus(left) === "running" && getTaskDisplayStatus(right) !== "running") {
        return -1;
      }
      if (getTaskDisplayStatus(right) === "running" && getTaskDisplayStatus(left) !== "running") {
        return 1;
      }
      const leftValue = getQueueSortValue(left);
      const rightValue = getQueueSortValue(right);
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
      return String(left.id).localeCompare(String(right.id));
    });

  return queueTasks.map((task, index) => ({
    taskId: task.id,
    title: task.title,
    projectId: task.projectId,
    projectName: task.projectName,
    status: getTaskDisplayStatus(task),
    position: typeof task.queuePosition === "number" && Number.isFinite(task.queuePosition)
      ? task.queuePosition
      : index + 1,
    queueEnteredAt: task.queueEnteredAt || task.updatedAt,
    queueName: task.queueName,
    summary: task.userSummary || task.summary || task.pendingReasonDetail || task.description,
    issueNumber: task.issueNumber,
  }));
}
