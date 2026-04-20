import type { Locale, Requirement, Task, TaskStatus, WorkspaceAnomaly } from "./dashboardTypes";
import { getTaskPendingReason } from "./dashboardTaskState";

function deriveRequirementId(task: Task) {
  if (task.requirementId) return task.requirementId;
  if (typeof task.issueNumber === "number") return `issue:${task.issueNumber}`;
  return `${task.projectId}::${task.title}`;
}

function deriveRequirementStatus(task: Task): TaskStatus {
  return task.status;
}

export function buildRequirementsFromTasks(tasks: Task[]) {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = deriveRequirementId(task);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  return Array.from(grouped.entries())
    .map(([id, attempts]) => {
      const orderedAttempts = attempts
        .slice()
        .sort((left, right) => {
          if ((left.attemptNumber || 0) !== (right.attemptNumber || 0)) {
            return (right.attemptNumber || 0) - (left.attemptNumber || 0);
          }
          return right.id.localeCompare(left.id);
        });
      const latest = orderedAttempts[0];
      const accepted = typeof latest.acceptanceCompleted === "number"
        ? latest.acceptanceCompleted
        : latest.verificationResults?.filter((item) => item.status === "accepted").length || 0;
      const total = typeof latest.acceptanceTotal === "number"
        ? latest.acceptanceTotal
        : latest.acceptanceCriteria?.length || 0;
      return {
        id,
        projectId: latest.projectId,
        projectName: latest.projectName,
        title: latest.title,
        status: deriveRequirementStatus(latest),
        updatedAt: latest.updatedAt || "",
        latestAttemptId: latest.id,
        latestAttemptNumber: latest.attemptNumber || orderedAttempts.length,
        sourceIssue: latest.issueNumber ? { number: latest.issueNumber, url: latest.issueUrl } : null,
        acceptanceCompleted: accepted,
        acceptanceTotal: total,
        publishStatus: latest.publishStatus,
        publishMethod: latest.publishMethod,
        publishVerified: latest.publishVerified,
        healthFlags: latest.healthFlags,
        openFailureReason: latest.openFailureReason,
        userSummary: latest.userSummary || latest.summary,
        acceptanceCriteria: latest.acceptanceCriteria,
        verificationResults: latest.verificationResults,
        attempts: orderedAttempts,
      } satisfies Requirement;
    })
    .sort((left, right) => right.latestAttemptId.localeCompare(left.latestAttemptId));
}

export function normalizeDisplayText(value: string) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (text.includes("\n")) return text;

  return text
    .replace(/([。！？!?；;])(?=\S)/g, "$1\n")
    .replace(/([.])\s+(?=[A-Z0-9])/g, "$1\n");
}

export function getTaskFailurePreview(task: Task | null | undefined, locale: Locale) {
  if (!task) {
    return "";
  }
  const reason = String(task.pendingReasonDetail || task.openFailureReason || task.summary || "").trim();
  if (task.status === "waiting") {
    const pendingReason = getTaskPendingReason(task);
    if (pendingReason === "plan_feedback") {
      return locale === "zh-CN"
        ? "当前计划还需要你的反馈或补充说明，处理后任务会继续回到队列。"
        : "The plan still needs your feedback or extra constraints before the task can continue.";
    }
    if (pendingReason === "user_decision") {
      return locale === "zh-CN"
        ? "任务已经产出需要你拍板的结论，提交意见后才能继续执行。"
        : "The task produced a decision point that needs your input before execution can continue.";
    }
    if (pendingReason === "manual_intervention") {
      return locale === "zh-CN"
        ? `任务当前需要人工介入：${reason || "请打开详情查看最近故障点和建议动作。"}`
        : `The task currently needs manual intervention: ${reason || "Open the detail view for the latest issue and suggested action."}`;
    }
  }
  return "";
}

export function getRequirementPreview(requirement: Requirement, locale: Locale) {
  const latestAttempt = requirement.attempts[0];
  const pendingMessage = normalizeDisplayText(latestAttempt?.pendingAction?.message || "");
  if (pendingMessage) return pendingMessage;
  const failurePreview = normalizeDisplayText(getTaskFailurePreview(latestAttempt, locale));
  if (failurePreview) return failurePreview;
  const planPreview = normalizeDisplayText(
    latestAttempt && (latestAttempt.status === "waiting" || latestAttempt.planDraftPending || Boolean(latestAttempt.pendingAction))
      ? latestAttempt.planPreview || ""
      : "",
  );
  if (planPreview) return planPreview;

  const summary = normalizeDisplayText(requirement.userSummary || latestAttempt?.userSummary || latestAttempt?.summary || "");
  if (summary) return summary;

  const description = normalizeDisplayText(latestAttempt?.description || "");
  if (description) return description;

  const failureReason = normalizeDisplayText(requirement.openFailureReason || latestAttempt?.openFailureReason || "");
  if (failureReason) return failureReason;

  return locale === "zh-CN" ? "暂无描述" : "No description";
}

export function getRequirementAnomalies(requirement: Requirement, locale: Locale): WorkspaceAnomaly[] {
  const result: WorkspaceAnomaly[] = [];
  const latestAttempt = requirement.attempts[0];
  const preview = getRequirementPreview(requirement, locale);
  const pushAnomaly = (idSuffix: string, detail: string) => {
    const normalizedDetail = normalizeDisplayText(detail) || preview;
    result.push({
      id: `${requirement.id}:${idSuffix}`,
      title: requirement.title,
      status: requirement.status,
      detail: normalizedDetail,
      taskId: requirement.latestAttemptId,
      fingerprint: JSON.stringify({
        requirementId: requirement.id,
        idSuffix,
        status: requirement.status,
        detail: normalizedDetail,
        latestAttemptId: requirement.latestAttemptId,
        updatedAt: requirement.updatedAt,
      }),
    });
  };

  if (requirement.status === "waiting" && getTaskPendingReason(latestAttempt || requirement.attempts[0]) === "manual_intervention") {
    pushAnomaly("manual_intervention", requirement.openFailureReason || requirement.userSummary || preview);
  }

  if ((requirement.healthFlags || []).length) {
    pushAnomaly(
      "health",
      `${locale === "zh-CN" ? "健康标记" : "Health flags"}: ${(requirement.healthFlags || []).join(", ")}`,
    );
  }

  return result;
}
