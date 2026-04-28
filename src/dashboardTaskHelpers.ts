import type { Task, Locale, StatusLabelMap, StatusTagColorMap } from "./dashboardTypes";
import { canCancelTask, getTaskPendingReason, getTaskPendingReasonLabel } from "./dashboardTaskState";

export function getDisplayedStatusText(task: Task, locale: Locale, statusLabel: StatusLabelMap) {
  if (task.pendingAction?.label) {
    return task.pendingAction.label;
  }
  if (task.planDraftPending && task.status === "waiting") {
    return locale === "zh-CN" ? "继续处理中" : "Processing";
  }
  if (task.status === "waiting") {
    return getTaskPendingReasonLabel(task, locale);
  }
  return statusLabel[task.status][locale];
}

export function getDisplayedStatusColor(task: Task, statusTagColor: StatusTagColorMap) {
  if (task.pendingAction) {
    return task.pendingAction.phase === "timed_out" ? "warning" : "processing";
  }
  if (task.planDraftPending && task.status === "waiting") {
    return "processing";
  }
  return statusTagColor[task.status];
}

export function formatTaskTimestamp(value: string | undefined, locale: Locale) {
  if (!value) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function findStatusTimestamp(task: Task, status: Task["status"]) {
  const pattern = new RegExp(`status changed to\\s+\`${status}\``, "i");
  const matched = [...task.logs].reverse().find((entry) => pattern.test(entry.message));
  if (matched?.timestamp) {
    return matched.timestamp;
  }
  if (task.status === status) {
    return task.updatedAt || "";
  }
  return "";
}

export function getTaskFailureDiagnosis(task: Task, locale: Locale) {
  const pendingReason = getTaskPendingReason(task);
  const reason = String(task.pendingReasonDetail || task.openFailureReason || task.summary || "").trim();
  if (task.status !== "waiting" || pendingReason !== "manual_intervention") {
    return null;
  }

  if (task.executionMode === "orchestrated" && task.failureType === "step_failed") {
    const currentStep = task.projectExecution?.steps?.find((step) => step.id === task.projectExecution?.currentStepId);
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "项目流在当前步骤受阻，可继续处理"
        : "The project flow is blocked on the current step and can continue from there",
      summary: locale === "zh-CN"
        ? `当前阻塞发生在步骤「${currentStep?.title || task.failurePhase || "未知步骤"}」。继续处理不会重开任务，会直接沿当前链路往下走。`
        : `The blockage happened on "${currentStep?.title || task.failurePhase || "the current step"}". Continuing will stay on the same task history instead of reopening it.`,
      timeline: locale === "zh-CN"
        ? `最近受阻记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest blocked record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "先看下面的原因；如果方向没问题，直接点“继续处理”即可。"
        : "Read the recorded reason first. If the direction is still correct, continue from here.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  if (task.executionMode === "orchestrated" && task.failureType === "stalled_project_flow") {
    return {
      type: "warning" as const,
      title: locale === "zh-CN"
        ? "项目流失去了活动步骤，需要人工继续"
        : "The project flow lost its active step and needs manual continuation",
      summary: locale === "zh-CN"
        ? "系统没有检测到当前应该继续执行的项目步骤，所以先把任务转为待处理。"
        : "The system could not find an active step to continue, so the task was moved into pending handling.",
      timeline: locale === "zh-CN"
        ? `最近待处理记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest pending-handling record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "直接点“继续处理”即可按保留的项目流状态往下走。"
        : "Use Continue to resume from the preserved project-flow state.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  if (/prolonged inactivity without a final summary/i.test(reason)) {
    const runningAt = findStatusTimestamp(task, "running");
    const failedAt = task.updatedAt || "";
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "执行阶段长时间无进展，已转人工介入"
        : "Execution stalled and now needs manual intervention",
      summary: locale === "zh-CN"
        ? "任务进入执行后，长时间没有新的进度更新，也没有写出最终总结，所以系统把它转到了待处理。"
        : "After the task entered running, it stopped producing progress updates and never wrote a final summary, so the system moved it into pending handling.",
      timeline: locale === "zh-CN"
        ? `进入执行：${formatTaskTimestamp(runningAt, locale)}；转待处理：${formatTaskTimestamp(failedAt, locale)}`
        : `Entered running: ${formatTaskTimestamp(runningAt, locale)}; moved to pending handling: ${formatTaskTimestamp(failedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "建议先点“继续处理”或“重试”。如果再次出现，需要排查执行环境、网络访问或外部命令阻塞。"
        : "Try Continue or Retry first. If it happens again, investigate the execution environment, network access, or blocked external commands.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  const canTaskBeCancelled = canCancelTask(task);
  return {
    type: "warning" as const,
    title: locale === "zh-CN" ? "任务需要人工介入" : "The task needs manual intervention",
    summary: locale === "zh-CN"
      ? "任务没有完成，但也没有被归档。系统已经把它转为待处理，等待你决定下一步动作。"
      : "The task did not finish and has been moved into pending handling while it waits for your next action.",
    timeline: locale === "zh-CN"
      ? `最近待处理记录：${formatTaskTimestamp(task.updatedAt, locale)}`
      : `Latest pending-handling record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
    guidance: locale === "zh-CN"
      ? (canTaskBeCancelled
          ? "先看当前原因，再决定继续处理、重试，还是直接取消。"
          : "先看当前原因，再决定继续处理或重试；如果已发布结果不符合预期，请打回返修。")
      : (canTaskBeCancelled
          ? "Read the current reason first, then decide whether to continue, retry, or cancel."
          : "Read the current reason first, then continue or retry. If the published result is wrong, send it back for revision instead of cancelling."),
    rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
  };
}
