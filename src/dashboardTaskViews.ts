import type { Locale, Requirement, Task, TaskStatus, WorkspaceAnomaly } from "./dashboardTypes";

function deriveRequirementId(task: Task) {
  if (task.requirementId) return task.requirementId;
  if (typeof task.issueNumber === "number") return `issue:${task.issueNumber}`;
  return `${task.projectId}::${task.title}`;
}

function deriveRequirementStatus(task: Task): TaskStatus {
  if (task.pendingAction) {
    return "pending";
  }
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
      const accepted = latest.verificationResults?.filter((item) => item.status === "accepted").length || 0;
      const total = latest.acceptanceCriteria?.length || 0;
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
  const reason = String(task.openFailureReason || task.summary || "").trim();
  const hasFailureStatus = ["failed", "stopped", "needs_revision", "publish_failed"].includes(task.status);
  if (!reason && !hasFailureStatus) {
    return "";
  }
  if (task.executionMode === "orchestrated" && hasFailureStatus && task.failureType === "step_failed") {
    const currentStep = task.projectExecution?.steps?.find((step) => step.id === task.projectExecution?.currentStepId);
    return locale === "zh-CN"
      ? `项目流在步骤「${currentStep?.title || task.failurePhase || "当前步骤"}」失败，可直接恢复执行，不需要重新审批计划。`
      : `The project flow failed on "${currentStep?.title || task.failurePhase || "the current step"}". You can resume without re-approving the plan.`;
  }
  if (task.executionMode === "orchestrated" && hasFailureStatus && task.failureType === "stalled_project_flow") {
    return locale === "zh-CN"
      ? "项目流失去了活动步骤，已暂停；直接恢复执行即可继续保留的项目流。"
      : "The project flow lost its active step and paused. Resume to continue from the preserved project-flow state.";
  }
  if (task.status === "failed" && /prolonged inactivity without a final summary/i.test(reason)) {
    return locale === "zh-CN"
      ? "执行阶段长时间没有新的进度或最终总结，系统已自动将任务判定为失败。"
      : "The task stopped producing progress or a final summary during execution and was auto-failed by the recovery monitor.";
  }
  if (task.status === "publish_failed") {
    return locale === "zh-CN"
      ? "实现已完成，但发布或同步环节失败。打开详情可查看具体错误和建议动作。"
      : "Implementation finished, but publish or sync failed. Open the detail view for the exact error and next steps.";
  }
  if (task.status === "needs_revision") {
    return locale === "zh-CN"
      ? "当前结果没有通过完成条件，仍需返修后才能继续。"
      : "The current result did not pass the completion criteria and needs revision before continuing.";
  }
  if (task.status === "stopped") {
    return locale === "zh-CN"
      ? "任务在完成前被停止了。"
      : "The task was stopped before completion.";
  }
  if (task.status === "failed") {
    return locale === "zh-CN"
      ? `任务执行失败：${reason || "未返回更多错误信息。"}`
      : `Task execution failed: ${reason || "No additional error details were provided."}`;
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
    latestAttempt && (latestAttempt.status === "waiting_user" || latestAttempt.planDraftPending || Boolean(latestAttempt.pendingAction))
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

  if (requirement.status === "stopped" || requirement.status === "needs_revision" || requirement.status === "publish_failed") {
    pushAnomaly(requirement.status, requirement.openFailureReason || requirement.userSummary || preview);
  }

  if ((requirement.healthFlags || []).length) {
    pushAnomaly(
      "health",
      `${locale === "zh-CN" ? "健康标记" : "Health flags"}: ${(requirement.healthFlags || []).join(", ")}`,
    );
  }

  return result;
}
