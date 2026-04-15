import type { PlanForm, PlanQuestion, ProjectExecution, ProjectExecutionStep, Task, TaskLog, TaskStatus } from "./dashboardTypes";

const TASK_STATUSES = new Set<TaskStatus>([
  "pending_capture",
  "pending",
  "running",
  "waiting_user",
  "awaiting_acceptance",
  "needs_revision",
  "publish_failed",
  "superseded",
  "implemented",
  "failed",
  "completed",
  "stopped",
]);

export type IssueComment = {
  body: string;
  created_at?: string;
};

function normalizeCommentLogMessage(body: string) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function parseEmbeddedTaskStatusPayload(body: string) {
  const match = String(body || "").match(/<!--\s*codex-task-status\s*([\s\S]*?)\s*-->/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as {
      taskId?: string;
      status?: TaskStatus;
      summary?: string;
      userSummary?: string;
      planPreview?: string;
      planForm?: PlanForm | null;
      planDraftPending?: boolean;
      lastStatusCommentAt?: string;
      userAction?: Task["userAction"];
      openFailureReason?: string;
      publishStatus?: string;
      executionMode?: string;
      projectExecution?: ProjectExecution | null;
      executionDecisionGate?: Task["executionDecisionGate"];
      resumeEligible?: boolean;
      failureType?: string;
      failurePhase?: string;
      internalOnly?: boolean;
    };
  } catch {
    return null;
  }
}

function parseCommentCommand(body: string) {
  const firstLine = String(body || "")
    .split("\n")[0]
    ?.trim()
    .toLowerCase();
  if (!firstLine?.startsWith("/")) return "";
  return firstLine.split(/\s+/, 1)[0] || "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizePlanQuestionKind(value: unknown): PlanQuestion["kind"] {
  const raw = String(value || "").trim();
  if (raw === "single_choice" || raw === "multi_choice" || raw === "text") {
    return raw;
  }
  return "text";
}

export function normalizePlanForm(input: unknown): PlanForm | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const rawQuestions = Array.isArray((input as { questions?: unknown[] }).questions)
    ? (input as { questions?: unknown[] }).questions || []
    : [];
  const questions: PlanQuestion[] = [];
  rawQuestions.forEach((question, index) => {
    if (!question || typeof question !== "object") {
      return;
    }
    const prompt = String((question as { prompt?: string }).prompt || "").trim();
    if (!prompt) {
      return;
    }
    const kind = normalizePlanQuestionKind((question as { kind?: unknown }).kind);
    const options = Array.isArray((question as { options?: unknown[] }).options)
      ? ((question as { options?: unknown[] }).options || [])
        .map((option) => String(option || "").trim())
        .filter(Boolean)
      : [];
    questions.push({
      id: String((question as { id?: string }).id || "").trim() || `q-${index + 1}`,
      prompt,
      description: String((question as { description?: string }).description || "").trim() || undefined,
      kind: options.length >= 2 ? kind : "text",
      options: options.length >= 2 ? options : undefined,
      required: (question as { required?: boolean }).required !== false,
      placeholder: String((question as { placeholder?: string }).placeholder || "").trim() || undefined,
    });
  });
  if (!questions.length) {
    return null;
  }
  return {
    title: String((input as { title?: string }).title || "").trim() || undefined,
    description: String((input as { description?: string }).description || "").trim() || undefined,
    questions,
  };
}

function normalizeProjectExecutionStep(input: unknown): ProjectExecutionStep | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const title = String(record.title || "").trim();
  if (!title) {
    return null;
  }
  return {
    id: String(record.id || "").trim() || `step-${Math.random().toString(36).slice(2, 8)}`,
    type: String(record.type || "implement").trim() || "implement",
    title,
    outcome: String(record.outcome || "").trim(),
    status: String(record.status || "pending").trim() || "pending",
    requiresDecision: Boolean(record.requiresDecision),
    autoCompleted: Boolean(record.autoCompleted),
    completedAt: String(record.completedAt || "").trim() || undefined,
    currentAttemptId: String(record.currentAttemptId || "").trim() || undefined,
    lastAttemptNumber: typeof record.lastAttemptNumber === "number" ? record.lastAttemptNumber : undefined,
    lastFailure: String(record.lastFailure || "").trim() || undefined,
    decision: String(record.decision || "").trim() || undefined,
    decisionResolved: typeof record.decisionResolved === "boolean" ? record.decisionResolved : undefined,
  };
}

export function normalizeProjectExecution(input: unknown): ProjectExecution | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const steps = Array.isArray(record.steps)
    ? record.steps.map((step) => normalizeProjectExecutionStep(step)).filter((step): step is ProjectExecutionStep => Boolean(step))
    : [];
  if (!steps.length) {
    return null;
  }
  const docs = asRecord(record.docs);
  return {
    version: typeof record.version === "number" ? record.version : undefined,
    initializedAt: String(record.initializedAt || "").trim() || undefined,
    currentStepId: String(record.currentStepId || "").trim() || undefined,
    currentStepIndex: typeof record.currentStepIndex === "number" ? record.currentStepIndex : undefined,
    researchNotes: String(record.researchNotes || "").trim() || undefined,
    resumeEligible: typeof record.resumeEligible === "boolean" ? record.resumeEligible : undefined,
    docs: docs
      ? {
          planPath: String(docs.planPath || "").trim() || undefined,
          decisionsPath: String(docs.decisionsPath || "").trim() || undefined,
          researchPath: String(docs.researchPath || "").trim() || undefined,
        }
      : null,
    steps,
  };
}

export function normalizeExecutionDecisionGate(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const stepId = String(record.stepId || "").trim();
  const title = String(record.title || "").trim();
  const prompt = String(record.prompt || "").trim();
  if (!stepId || !title || !prompt) {
    return null;
  }
  return {
    stepId,
    title,
    prompt,
    stepType: String(record.stepType || "").trim() || undefined,
    childTaskId: String(record.childTaskId || "").trim() || undefined,
    form: normalizePlanForm(record.form),
  };
}

function getCurrentStepTitle(projectExecution: ProjectExecution | null | undefined) {
  const currentStepId = String(projectExecution?.currentStepId || "").trim();
  if (!currentStepId) {
    return "";
  }
  const currentStep = (projectExecution?.steps || []).find((step) => step.id === currentStepId);
  return String(currentStep?.title || currentStepId).trim();
}

function buildOperatorCommentMessage(snapshot: {
  status: TaskStatus;
  summary: string;
  userSummary: string;
  openFailureReason: string;
  publishStatus: string;
  executionMode: string;
  projectExecution: ProjectExecution | null;
  executionDecisionGate: Task["executionDecisionGate"];
  failureType: string;
  failurePhase: string;
}) {
  const currentStepTitle = getCurrentStepTitle(snapshot.projectExecution);
  if (snapshot.executionDecisionGate?.title && snapshot.status === "waiting_user") {
    return `步骤「${snapshot.executionDecisionGate.title}」已完成，等待你的决策。`;
  }
  if (snapshot.executionMode === "orchestrated" && snapshot.status === "running" && currentStepTitle) {
    return `项目流正在执行步骤「${currentStepTitle}」。`;
  }
  if (snapshot.executionMode === "orchestrated" && snapshot.status === "pending" && currentStepTitle) {
    return `项目流已排队，准备继续步骤「${currentStepTitle}」。`;
  }
  if (snapshot.status === "failed" && snapshot.failureType === "step_failed") {
    const stepLabel = currentStepTitle || snapshot.failurePhase || "当前步骤";
    return `步骤「${stepLabel}」失败：${snapshot.openFailureReason || snapshot.userSummary || snapshot.summary || "没有返回更多原因。"}`
      .trim();
  }
  if (snapshot.status === "awaiting_acceptance" && snapshot.executionMode === "orchestrated") {
    return "项目流全部步骤已完成，等待最终验收。";
  }
  if (snapshot.status === "publish_failed") {
    return `实现已完成，但发布失败：${snapshot.openFailureReason || snapshot.summary || "没有返回更多原因。"}`
      .trim();
  }
  if (snapshot.status === "needs_revision") {
    return `当前结果仍需返修：${snapshot.openFailureReason || snapshot.userSummary || snapshot.summary || "没有返回更多原因。"}`
      .trim();
  }
  return snapshot.userSummary || snapshot.summary || "";
}

export function parseStatusFromComments(comments: IssueComment[], fallbackClosed: boolean): {
  status: TaskStatus;
  taskId: string;
  summary: string;
  userSummary: string;
  planPreview: string;
  planForm: PlanForm | null;
  planDraftPending: boolean;
  lastStatusCommentAt: string;
  userAction: Task["userAction"];
  openFailureReason: string;
  publishStatus: string;
  executionMode: string;
  projectExecution: ProjectExecution | null;
  executionDecisionGate: Task["executionDecisionGate"];
  resumeEligible: boolean;
  failureType: string;
  failurePhase: string;
  internalOnly: boolean;
} {
  let status: TaskStatus = fallbackClosed ? "completed" : "pending";
  let taskId = "";
  let summary = "";
  let userSummary = "";
  let planPreview = "";
  let planForm: PlanForm | null = null;
  let planDraftPending = false;
  let lastStatusCommentAt = "";
  let userAction: Task["userAction"] = null;
  let openFailureReason = "";
  let publishStatus = "";
  let executionMode = "";
  let projectExecution: ProjectExecution | null = null;
  let executionDecisionGate: Task["executionDecisionGate"] = null;
  let resumeEligible = false;
  let failureType = "";
  let failurePhase = "";
  let internalOnly = false;

  for (const comment of comments) {
    const rawBody = String(comment.body || "");
    const body = normalizeCommentLogMessage(rawBody);
    const embedded = parseEmbeddedTaskStatusPayload(rawBody);
    const embeddedRecord = embedded;
    const hasEmbeddedField = (field: string) => Boolean(embedded && Object.prototype.hasOwnProperty.call(embedded, field));
    if (hasEmbeddedField("taskId")) {
      taskId = String(embedded?.taskId || "").trim() || taskId;
    }
    if (hasEmbeddedField("status") && embedded?.status && TASK_STATUSES.has(embedded.status)) {
      status = embedded.status;
    }
    if (hasEmbeddedField("summary")) {
      summary = typeof embedded?.summary === "string" ? embedded.summary.trim() : "";
    }
    if (hasEmbeddedField("userSummary")) {
      userSummary = typeof embedded?.userSummary === "string" ? embedded.userSummary.trim() : "";
    }
    if (hasEmbeddedField("planPreview")) {
      planPreview = typeof embedded?.planPreview === "string" ? embedded.planPreview.trim() : "";
    }
    if (hasEmbeddedField("planForm")) {
      planForm = normalizePlanForm(embeddedRecord?.planForm);
    }
    if (hasEmbeddedField("planDraftPending")) {
      planDraftPending = Boolean(embeddedRecord?.planDraftPending);
    }
    if (hasEmbeddedField("lastStatusCommentAt")) {
      lastStatusCommentAt = typeof embedded?.lastStatusCommentAt === "string" ? embedded.lastStatusCommentAt.trim() : "";
    }
    if (hasEmbeddedField("userAction")) {
      userAction = embedded?.userAction && typeof embedded.userAction === "object" ? embedded.userAction : null;
    }
    if (hasEmbeddedField("openFailureReason")) {
      openFailureReason = typeof embedded?.openFailureReason === "string" ? embedded.openFailureReason.trim() : "";
    }
    if (hasEmbeddedField("publishStatus")) {
      publishStatus = typeof embedded?.publishStatus === "string" ? embedded.publishStatus.trim() : "";
    }
    if (hasEmbeddedField("executionMode")) {
      executionMode = typeof embedded?.executionMode === "string" ? embedded.executionMode.trim() : "";
    }
    if (hasEmbeddedField("projectExecution")) {
      projectExecution = normalizeProjectExecution(embeddedRecord?.projectExecution);
    }
    if (hasEmbeddedField("executionDecisionGate")) {
      executionDecisionGate = normalizeExecutionDecisionGate(embeddedRecord?.executionDecisionGate);
    }
    if (hasEmbeddedField("resumeEligible")) {
      resumeEligible = Boolean(embeddedRecord?.resumeEligible);
    }
    if (hasEmbeddedField("failureType")) {
      failureType = typeof embedded?.failureType === "string" ? embedded.failureType.trim() : "";
    }
    if (hasEmbeddedField("failurePhase")) {
      failurePhase = typeof embedded?.failurePhase === "string" ? embedded.failurePhase.trim() : "";
    }
    if (hasEmbeddedField("internalOnly")) {
      internalOnly = Boolean(embeddedRecord?.internalOnly);
    }

    const imported = body.match(/Task imported as\s+`([^`]+)`/i);
    if (imported) {
      taskId = imported[1];
    }
    const statusMatch = body.match(/Task\s+`([^`]+)`\s+status changed to\s+`([^`]+)`/i);
    if (statusMatch) {
      taskId = statusMatch[1];
      lastStatusCommentAt = comment.created_at || lastStatusCommentAt;
      const next = statusMatch[2].toLowerCase() as TaskStatus;
      if (TASK_STATUSES.has(next)) {
        status = next;
      }
      const summaryMatch = body.match(/Summary:\s*([\s\S]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
      const publishMatch = body.match(/Publish:\s*`?([^`\n]+)`?/i);
      if (publishMatch) {
        publishStatus = publishMatch[1].trim();
      }
      if (!hasEmbeddedField("openFailureReason")) {
        openFailureReason = "";
      }
      const openReasonLine = body
        .split("\n")
        .find((line) => /^Open reason:\s*/i.test(line));
      if (openReasonLine) {
        openFailureReason = openReasonLine.replace(/^Open reason:\s*/i, "").trim();
      }
    }
  }

  return {
    status,
    taskId,
    summary,
    userSummary: userSummary || summary,
    planPreview,
    planForm,
    planDraftPending,
    lastStatusCommentAt,
    userAction,
    openFailureReason,
    publishStatus,
    executionMode,
    projectExecution,
    executionDecisionGate,
    resumeEligible,
    failureType,
    failurePhase,
    internalOnly,
  };
}

export function buildLogsFromComments(comments: IssueComment[]) {
  const entries: Array<TaskLog & { sortIndex: number }> = [];
  comments.forEach((comment, index) => {
    const rawBody = String(comment.body || "");
    const message = normalizeCommentLogMessage(rawBody);
    if (!message) {
      return;
    }

    const command = parseCommentCommand(message);
    if (["/approve", "/reject", "/feedback", "/retry", "/restart", "/stop"].includes(command)) {
      return;
    }

    const embedded = parseEmbeddedTaskStatusPayload(rawBody);
    const operatorMessage = embedded
      ? buildOperatorCommentMessage({
          status: embedded.status && TASK_STATUSES.has(embedded.status) ? embedded.status : "pending",
          summary: String(embedded.summary || "").trim(),
          userSummary: String(embedded.userSummary || "").trim(),
          openFailureReason: String(embedded.openFailureReason || "").trim(),
          publishStatus: String(embedded.publishStatus || "").trim(),
          executionMode: String(embedded.executionMode || "").trim(),
          projectExecution: normalizeProjectExecution(embedded.projectExecution),
          executionDecisionGate: normalizeExecutionDecisionGate(embedded.executionDecisionGate),
          failureType: String(embedded.failureType || "").trim(),
          failurePhase: String(embedded.failurePhase || "").trim(),
        })
      : "";
    const fallbackMessage = /Task imported as/i.test(message)
      ? "已从 GitHub Issue 导入任务。"
      : message;

    entries.push({
      timestamp: comment.created_at || new Date(0).toISOString(),
      message: operatorMessage || fallbackMessage,
      audience: "operator",
      sortIndex: index,
    });
  });

  return entries
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp);
      const rightTime = Date.parse(right.timestamp);
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.sortIndex - right.sortIndex;
    })
    .map(({ timestamp, message, audience }) => ({ timestamp, message, audience }));
}
