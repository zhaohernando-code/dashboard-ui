import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TaskStatus =
  | "pending_capture"
  | "pending"
  | "running"
  | "waiting_user"
  | "awaiting_acceptance"
  | "needs_revision"
  | "publish_failed"
  | "superseded"
  | "implemented"
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
  updatedAt?: string;
  requirementId?: string;
  attemptNumber?: number;
  projectId: string;
  projectName: string;
  type: string;
  title: string;
  description: string;
  status: TaskStatus;
  requirementStatus?: TaskStatus;
  summary: string;
  rawWorkerSummary?: string;
  userSummary?: string;
  userAction?: {
    type: string;
    title: string;
    detail: string;
    risk: "low" | "medium" | "high";
  } | null;
  planPreview: string;
  workspacePath: string;
  branchName: string;
  publishStatus?: string;
  publishMethod?: string;
  publishVerified?: boolean;
  healthFlags?: string[];
  openFailureReason?: string;
  acceptanceCriteria?: Array<{ id: string; text: string }>;
  verificationResults?: Array<{ criterionId: string; type: string; status: string; evidence: string }>;
  logs: TaskLog[];
  children: TaskChild[];
  issueNumber?: number;
  issueUrl?: string;
};

type Requirement = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
  latestAttemptId: string;
  latestAttemptNumber: number;
  sourceIssue?: { number?: number; url?: string } | null;
  acceptanceCompleted: number;
  acceptanceTotal: number;
  publishStatus?: string;
  publishMethod?: string;
  publishVerified?: boolean;
  healthFlags?: string[];
  openFailureReason?: string;
  userSummary?: string;
  acceptanceCriteria?: Array<{ id: string; text: string }>;
  verificationResults?: Array<{ criterionId: string; type: string; status: string; evidence: string }>;
  attempts: Task[];
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
  memberUsageUsed?: number | null;
  memberUsageTotal?: number | null;
  memberUsageRatio?: number | null;
  memberUsageUnit?: string;
  memberUsageReason?: string;
  rateLimits?: {
    primary: UsageLimitWindow | null;
    secondary: UsageLimitWindow | null;
  };
  statusCollectedAt?: string;
  statusSource?: string;
};

type UsageLimitWindow = {
  usedPercent: number | null;
  windowMinutes: number | null;
  resetsAt: string;
  sourceLabel?: string;
};

type PlatformHealth = {
  generatedAt: string;
  taskBackend: string;
  githubTaskRepo: string;
  issuePoller: {
    enabled: boolean;
    status: string;
    intervalMs: number;
    inFlight: boolean;
    lastStartedAt: string;
    lastSuccessAt: string;
    lastDurationMs: number;
    lastError: string;
  };
  githubApi: {
    inFlight: number;
    queued: number;
    lastRequestAt: string;
    lastError: string;
    lastRateLimitAt: string;
    lastRetryAt: string;
    remaining: string | null;
    resetAt: string;
  };
  publishing: {
    lastPublishedAt: string;
    lastPublishedTaskId: string;
    lastPublishedTaskTitle: string;
    lastPublishMethod: string;
    lastPublishError: string;
    publishedTasks: number;
    noopTasks: number;
    publishFailedTasks: number;
    completedWithoutVerifiedPublish: number;
  };
  taskState: {
    total: number;
    running: number;
    waitingUser: number;
    awaitingAcceptance: number;
    needsRevision: number;
    publishFailed: number;
    stoppedLatest: number;
  };
  anomalies: Array<{
    id: string;
    severity: string;
    count: number;
    description: string;
    taskIds: string[];
  }>;
};

type AuthConfig = {
  enabled: boolean;
  mode: string;
  provider: string;
  hasClientId: boolean;
  repoAutomationEnabled: boolean;
  taskBackend?: string;
  githubTaskRepo?: string;
  user: null | {
    login: string;
    name: string;
  };
};

type IssueTask = {
  number: number;
  url: string;
  repo: string;
};

type DeviceLoginSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSec: number;
  status: string;
  error: string;
};

type NoticeTone = "info" | "success" | "error";

type NoticeItem = {
  id: number;
  message: string;
  tone: NoticeTone;
};

type DismissedAnomaly = {
  id: string;
  dismissedAt: string;
};

type WorkspaceAnomaly = {
  id: string;
  title: string;
  status: TaskStatus;
  detail: string;
  taskId: string;
  fingerprint: string;
};

type Locale = "zh-CN" | "en-US";
type CopyState = "idle" | "copied";
type ThemeMode = "light" | "dark";
type WorkspaceLevel = "projects" | "tasks" | "detail";
type RuntimeMode = "local-api" | "github-direct";
type CreateDialogMode = "project" | "task" | "composite_task";
type StatusFilterValue = TaskStatus | "all";

const DEFAULT_API_BASE = (import.meta.env.VITE_DEFAULT_API_BASE as string | undefined)?.trim() || "http://localhost:8787";
const GITHUB_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() || "";
const GITHUB_TASK_REPO = (import.meta.env.VITE_GITHUB_TASK_REPO as string | undefined)?.trim() || "zhaohernando-code/dashboard-ui";
const GITHUB_SCOPES = (import.meta.env.VITE_GITHUB_OAUTH_SCOPES as string | undefined)?.trim() || "read:user repo";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const AUTO_ROUTE_PROJECT_ID = "__auto_route__";
const CLOSED_ANOMALIES_STORAGE_KEY = "codex.dismissedAnomalies";
const STATUS_FILTER_ALL = "all";
const REMOTE_PROJECT_CATALOG = [
  {
    id: "dashboard-ui",
    name: "dashboard-ui",
    description: "GitHub Pages dashboard for project and issue-driven task dispatch.",
    repository: "https://github.com/zhaohernando-code/dashboard-ui",
    toolRoute: "/tools/dashboard-ui",
  },
  {
    id: "local-control-server",
    name: "local-control-server",
    description: "Local poller/executor that consumes GitHub issue tasks.",
    repository: "https://github.com/zhaohernando-code/local-control-server",
    toolRoute: "/tools/local-control-server",
  },
] satisfies Array<Pick<Project, "id" | "name" | "description" | "repository" | "toolRoute">>;

const tabs = [
  { id: "quest-center", label: { "zh-CN": "工作台", "en-US": "Workspace" } },
  { id: "tools", label: { "zh-CN": "工具入口", "en-US": "Tools" } },
  { id: "usage", label: { "zh-CN": "用量概览", "en-US": "Usage" } },
] as const;

const statusLabel: Record<TaskStatus, Record<Locale, string>> = {
  pending_capture: { "zh-CN": "待捕获", "en-US": "Awaiting pickup" },
  pending: { "zh-CN": "等待中", "en-US": "Pending" },
  running: { "zh-CN": "运行中", "en-US": "Running" },
  waiting_user: { "zh-CN": "待你确认", "en-US": "Awaiting Approval" },
  awaiting_acceptance: { "zh-CN": "待验收", "en-US": "Awaiting acceptance" },
  needs_revision: { "zh-CN": "待返修", "en-US": "Needs revision" },
  publish_failed: { "zh-CN": "发布失败", "en-US": "Publish failed" },
  superseded: { "zh-CN": "已归档", "en-US": "Superseded" },
  implemented: { "zh-CN": "已实现", "en-US": "Implemented" },
  failed: { "zh-CN": "失败", "en-US": "Failed" },
  completed: { "zh-CN": "完成", "en-US": "Completed" },
  stopped: { "zh-CN": "已停止", "en-US": "Stopped" },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}


function parseTaskType(value: string) {
  const raw = String(value || "task").trim().toLowerCase();
  if (raw === "project_create" || raw === "composite_task" || raw === "task") {
    return raw;
  }
  return "task";
}

function parseIssueBody(body: string) {
  const embedded = body.match(/<!--\s*codex-task-payload\s*([\s\S]*?)\s*-->/i);
  if (embedded) {
    try {
      const payload = JSON.parse(embedded[1]);
      return {
        projectId: String(payload.projectId || "dashboard-ui").trim() || "dashboard-ui",
        type: parseTaskType(payload.type),
        title: String(payload.title || "Untitled task").trim(),
        description: String(payload.description || "").trim(),
      };
    } catch {
      // Fall through to plain parsing.
    }
  }

  const meta: Record<string, string> = {};
  for (const line of String(body || "").split("\n").slice(0, 12)) {
    const match = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)\s*$/);
    if (match) meta[match[1].toLowerCase()] = match[2].trim();
  }
  return {
    projectId: meta.project || meta.projectid || "dashboard-ui",
    type: parseTaskType(meta.type || "task"),
    title: "",
    description: String(body || "").replace(/<!--[\s\S]*?-->/g, "").trim(),
  };
}

type IssueComment = {
  body: string;
  created_at?: string;
};

function parseCommentCommand(body: string) {
  const firstLine = String(body || "")
    .split("\n")[0]
    ?.trim()
    .toLowerCase();
  if (!firstLine?.startsWith("/")) return "";
  return firstLine.split(/\s+/, 1)[0] || "";
}

function normalizeCommentLogMessage(body: string) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function parseStatusFromComments(comments: IssueComment[], fallbackClosed: boolean): { status: TaskStatus; taskId: string; summary: string } {
  let status: TaskStatus = fallbackClosed ? "completed" : "pending";
  let taskId = "";
  let summary = "";

  for (const comment of comments) {
    const body = String(comment.body || "");
    const imported = body.match(/Task imported as\s+`([^`]+)`/i);
    if (imported) {
      taskId = imported[1];
    }
    const statusMatch = body.match(/Task\s+`([^`]+)`\s+status changed to\s+`([^`]+)`/i);
    if (statusMatch) {
      taskId = statusMatch[1];
      const next = statusMatch[2].toLowerCase() as TaskStatus;
      if (["pending_capture", "pending", "running", "waiting_user", "awaiting_acceptance", "needs_revision", "publish_failed", "superseded", "implemented", "failed", "completed", "stopped"].includes(next)) {
        status = next;
      }
      const summaryMatch = body.match(/Summary:\s*([\s\S]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
    }
  }

  return { status, taskId, summary };
}

function buildLogsFromComments(comments: IssueComment[]) {
  return comments
    .map((comment, index) => {
      const message = normalizeCommentLogMessage(comment.body);
      if (!message) return null;

      const command = parseCommentCommand(message);
      if (["/approve", "/reject", "/retry", "/stop"].includes(command)) {
        return null;
      }

      return {
        timestamp: comment.created_at || new Date(0).toISOString(),
        message,
        sortIndex: index,
      };
    })
    .filter((entry): entry is TaskLog & { sortIndex: number } => Boolean(entry))
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp);
      const rightTime = Date.parse(right.timestamp);
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.sortIndex - right.sortIndex;
    })
    .map(({ timestamp, message }) => ({ timestamp, message }));
}

function buildRemoteProjects(tasks: Task[]) {
  const projectMap = new Map(
    REMOTE_PROJECT_CATALOG.map((project) => [
      project.id,
      {
        ...project,
        taskStats: {
          total: 0,
          running: 0,
          failed: 0,
          waitingUser: 0,
          completed: 0,
        },
      },
    ]),
  );

  for (const task of tasks) {
    if (!projectMap.has(task.projectId)) {
      projectMap.set(task.projectId, {
        id: task.projectId,
        name: task.projectId === AUTO_ROUTE_PROJECT_ID ? "AI-routed" : task.projectId,
        description:
          task.projectId === AUTO_ROUTE_PROJECT_ID
            ? "Composite or cross-project work waiting for AI routing."
            : "",
        repository: "",
        toolRoute: `/tools/${task.projectId}`,
        taskStats: { total: 0, running: 0, failed: 0, waitingUser: 0, completed: 0 },
      });
    }
    const project = projectMap.get(task.projectId)!;
    project.taskStats.total += 1;
    if (task.status === "running") project.taskStats.running += 1;
    if (task.status === "failed") project.taskStats.failed += 1;
    if (task.status === "waiting_user") project.taskStats.waitingUser += 1;
    if (task.status === "completed") project.taskStats.completed += 1;
  }

  return Array.from(projectMap.values());
}

function mergeProjectStats(baseProjects: Project[], tasks: Task[]) {
  const projectMap = new Map(
    baseProjects.map((project) => [
      project.id,
      {
        ...project,
        taskStats: {
          total: 0,
          running: 0,
          failed: 0,
          waitingUser: 0,
          completed: 0,
        },
      },
    ]),
  );

  for (const task of tasks) {
    if (!projectMap.has(task.projectId)) {
      projectMap.set(task.projectId, {
        id: task.projectId,
        name: getProjectDisplayName(task.projectId, "en-US"),
        description:
          task.projectId === AUTO_ROUTE_PROJECT_ID
            ? "Composite or cross-project work waiting for AI routing."
            : "",
        repository: "",
        toolRoute: `/tools/${task.projectId}`,
        taskStats: {
          total: 0,
          running: 0,
          failed: 0,
          waitingUser: 0,
          completed: 0,
        },
      });
    }
    const project = projectMap.get(task.projectId)!;
    project.taskStats.total += 1;
    if (task.status === "running") project.taskStats.running += 1;
    if (task.status === "failed") project.taskStats.failed += 1;
    if (task.status === "waiting_user") project.taskStats.waitingUser += 1;
    if (task.status === "completed") project.taskStats.completed += 1;
  }

  return Array.from(projectMap.values());
}

function isCompositeTask(type: string) {
  return parseTaskType(type) === "composite_task";
}

function getTaskProjectId(type: string, rawProjectId: string) {
  const normalizedProjectId = String(rawProjectId || "").trim();
  if (isCompositeTask(type)) {
    return AUTO_ROUTE_PROJECT_ID;
  }
  return normalizedProjectId || "dashboard-ui";
}

function getProjectDisplayName(projectId: string, locale: Locale) {
  if (projectId === AUTO_ROUTE_PROJECT_ID) {
    return locale === "zh-CN" ? "AI 待判定项目" : "AI-routed";
  }
  return projectId;
}

function matchesStatusFilter(status: TaskStatus, filter: StatusFilterValue) {
  return filter === STATUS_FILTER_ALL || status === filter;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIsoTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1e12 ? numeric : numeric * 1000).toISOString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeLimitWindow(raw: unknown, fallbackWindowMinutes: number): UsageLimitWindow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const usedPercentRaw =
    toFiniteNumber(record.usedPercent) ??
    toFiniteNumber(record.used_percent) ??
    toFiniteNumber(record.percent) ??
    toFiniteNumber(record.percentUsed);
  const usedPercent = usedPercentRaw === null
    ? null
    : usedPercentRaw > 1 && usedPercentRaw <= 100
      ? usedPercentRaw
      : usedPercentRaw <= 1
        ? usedPercentRaw * 100
        : Math.min(usedPercentRaw, 100);
  const windowMinutes =
    toFiniteNumber(record.windowMinutes) ??
    toFiniteNumber(record.window_minutes) ??
    toFiniteNumber(record.window) ??
    fallbackWindowMinutes;
  const resetsAt = toIsoTimestamp(record.resetsAt ?? record.resets_at ?? record.resetAt);
  const sourceLabel = String(record.limitName || record.limit_name || "").trim() || undefined;

  if (usedPercent === null && !resetsAt) return null;

  return {
    usedPercent,
    windowMinutes,
    resetsAt,
    sourceLabel,
  };
}

function formatUsageLimitReset(value: string, locale: Locale) {
  if (!value) return locale === "zh-CN" ? "重置时间未知" : "Reset time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "zh-CN" ? "重置时间未知" : "Reset time unavailable";
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeUsageOverview(raw: unknown): UsageOverview {
  const base = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const membership =
    (base.membershipUsage && typeof base.membershipUsage === "object" ? base.membershipUsage : null) ||
    (base.memberUsage && typeof base.memberUsage === "object" ? base.memberUsage : null) ||
    (base.quota && typeof base.quota === "object" ? base.quota : null);
  const membershipRecord = (membership || {}) as Record<string, unknown>;

  const memberUsageUsed =
    toFiniteNumber(membershipRecord.used) ??
    toFiniteNumber(membershipRecord.current) ??
    toFiniteNumber(base.memberUsageUsed) ??
    toFiniteNumber(base.quotaUsed);
  const memberUsageTotal =
    toFiniteNumber(membershipRecord.total) ??
    toFiniteNumber(membershipRecord.limit) ??
    toFiniteNumber(base.memberUsageTotal) ??
    toFiniteNumber(base.quotaTotal);
  const explicitRatio =
    toFiniteNumber(membershipRecord.ratio) ??
    toFiniteNumber(base.memberUsageRatio) ??
    toFiniteNumber(base.quotaRatio);
  const memberUsageRatio =
    explicitRatio !== null
      ? explicitRatio > 1
        ? explicitRatio / 100
        : explicitRatio
      : memberUsageUsed !== null && memberUsageTotal !== null && memberUsageTotal > 0
        ? memberUsageUsed / memberUsageTotal
        : null;
  const memberUsageReason =
    String(
      membershipRecord.reason ||
      membershipRecord.unavailableReason ||
      base.memberUsageReason ||
      base.quotaReason ||
      "",
    ).trim() || undefined;
  const rateLimitSources = [
    asRecord(base.rateLimits),
    asRecord(base.rate_limits),
    asRecord(asRecord(base.status)?.rateLimits),
    asRecord(asRecord(base.status)?.rate_limits),
  ].filter(Boolean) as Array<Record<string, unknown>>;
  const primaryLimit =
    normalizeLimitWindow(rateLimitSources.map((source) => source.primary).find(Boolean), 300) ||
    normalizeLimitWindow(rateLimitSources.map((source) => source.fiveHour).find(Boolean), 300) ||
    normalizeLimitWindow(rateLimitSources.map((source) => source["5h"]).find(Boolean), 300);
  const secondaryLimit =
    normalizeLimitWindow(rateLimitSources.map((source) => source.secondary).find(Boolean), 10080) ||
    normalizeLimitWindow(rateLimitSources.map((source) => source.weekly).find(Boolean), 10080) ||
    normalizeLimitWindow(rateLimitSources.map((source) => source.week).find(Boolean), 10080);

  return {
    totalTasks: toFiniteNumber(base.totalTasks) ?? 0,
    activeTasks: toFiniteNumber(base.activeTasks) ?? 0,
    pendingApprovals: toFiniteNumber(base.pendingApprovals) ?? 0,
    completedTasks: toFiniteNumber(base.completedTasks) ?? 0,
    failedTasks: toFiniteNumber(base.failedTasks) ?? 0,
    estimatedTokens: toFiniteNumber(base.estimatedTokens) ?? 0,
    totalRuns: toFiniteNumber(base.totalRuns) ?? 0,
    lastRunAt: String(base.lastRunAt || ""),
    memberUsageUsed,
    memberUsageTotal,
    memberUsageRatio,
    memberUsageUnit: String(membershipRecord.unit || base.memberUsageUnit || base.quotaUnit || "").trim() || undefined,
    memberUsageReason,
    rateLimits: {
      primary: primaryLimit,
      secondary: secondaryLimit,
    },
    statusCollectedAt: String(base.statusCollectedAt || ""),
    statusSource: String(base.statusSource || ""),
  };
}

function deriveRequirementId(task: Task) {
  if (task.requirementId) return task.requirementId;
  if (typeof task.issueNumber === "number") return `issue:${task.issueNumber}`;
  return `${task.projectId}::${task.title}`;
}

function buildRequirementsFromTasks(tasks: Task[]) {
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
        status: latest.status,
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

function isImportantLogMessage(message: string) {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;
  const importantMarkers = [
    "task accepted",
    "task execution started",
    "workspace prepared",
    "codex worker process spawned",
    "imported from github issue",
    "waiting for explicit approval",
    "status changed to",
    "task stopped",
    "task completed",
    "task failed",
    "publish",
    "warning",
    "error",
    "approval",
    "summary",
    "queued",
    "retry",
    "awaiting acceptance",
    "needs revision",
    "accepted",
    "rejected",
    "running",
    "stopped",
    "failed",
    "completed",
    "imported",
    "待捕获",
    "待验收",
    "发布",
    "审批",
    "失败",
    "完成",
    "已接受",
    "已拒绝",
    "运行",
    "停止",
  ];
  const noisyPrefixes = ["stderr: exec", "stdout: exec", "stderr: openai codex", "stdout: openai codex"];
  if (noisyPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return importantMarkers.some((marker) => normalized.includes(marker));
}

function buildLogViews(logs: TaskLog[]) {
  const importantLogs = logs.filter((entry) => isImportantLogMessage(entry.message));
  return {
    important: importantLogs.length ? importantLogs : logs.slice(-8),
    raw: logs,
  };
}

function normalizeDisplayText(value: string) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (text.includes("\n")) return text;

  return text
    .replace(/([。！？!?；;])(?=\S)/g, "$1\n")
    .replace(/([.])\s+(?=[A-Z0-9])/g, "$1\n");
}

function getRequirementPreview(requirement: Requirement, locale: Locale) {
  const latestAttempt = requirement.attempts[0];
  const summary = normalizeDisplayText(requirement.userSummary || latestAttempt?.userSummary || latestAttempt?.summary || "");
  if (summary) return summary;

  const description = normalizeDisplayText(latestAttempt?.description || "");
  if (description) return description;

  const failureReason = normalizeDisplayText(requirement.openFailureReason || latestAttempt?.openFailureReason || "");
  if (failureReason) return failureReason;

  return locale === "zh-CN" ? "暂无描述" : "No description";
}

function getRequirementAnomalies(requirement: Requirement, locale: Locale): WorkspaceAnomaly[] {
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

export default function App() {
  const runtimeMode: RuntimeMode = IS_GITHUB_PAGES ? "github-direct" : "local-api";
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("codex.locale");
    if (saved === "zh-CN" || saved === "en-US") return saved;
    return navigator.language.startsWith("zh") ? "zh-CN" : "en-US";
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("codex.theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [sessionToken, setSessionToken] = useState(localStorage.getItem("codex.sessionToken") || "");
  const [githubToken, setGithubToken] = useState(localStorage.getItem("codex.githubAccessToken") || "");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("quest-center");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tools, setTools] = useState<Array<{ id: string; name: string; route: string; description: string }>>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [usageSummary, setUsageSummary] = useState("");
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [workspaceLevel, setWorkspaceLevel] = useState<WorkspaceLevel>("projects");
  const [createDialogMode, setCreateDialogMode] = useState<CreateDialogMode | null>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [deviceLogin, setDeviceLogin] = useState<DeviceLoginSession | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<DismissedAnomaly[]>(() => {
    try {
      const saved = localStorage.getItem(CLOSED_ANOMALIES_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as DismissedAnomaly[]) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is DismissedAnomaly =>
              Boolean(item) &&
              typeof item.id === "string" &&
              typeof item.dismissedAt === "string",
          )
        : [];
    } catch {
      return [];
    }
  });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileViewDrawerOpen, setIsMobileViewDrawerOpen] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [requirementStatusFilter, setRequirementStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const pollTokenRef = useRef(0);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedTaskIdRef = useRef(selectedTaskId);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? optimisticTasks.find((task) => task.id === selectedTaskId) ?? null,
    [optimisticTasks, selectedTaskId, tasks],
  );

  const visibleTasks = useMemo(() => {
    if (!optimisticTasks.length) {
      return tasks;
    }
    const resolvedIssueNumbers = new Set(tasks.map((task) => task.issueNumber).filter((value): value is number => typeof value === "number"));
    const resolvedKeys = new Set(tasks.map((task) => `${task.projectId}::${task.type}::${task.title}::${task.description}`));
    const pendingOnly = optimisticTasks.filter((task) => {
      if (typeof task.issueNumber === "number" && resolvedIssueNumbers.has(task.issueNumber)) {
        return false;
      }
      return !resolvedKeys.has(`${task.projectId}::${task.type}::${task.title}::${task.description}`);
    });
    return [...pendingOnly, ...tasks];
  }, [optimisticTasks, tasks]);

  const visibleRequirements = useMemo(
    () => buildRequirementsFromTasks(visibleTasks),
    [visibleTasks],
  );

  const selectedRequirement = useMemo(
    () => visibleRequirements.find((requirement) => requirement.id === selectedRequirementId) ?? null,
    [selectedRequirementId, visibleRequirements],
  );

  const workspaceAnomalies = useMemo(
    () => visibleRequirements.flatMap((requirement) => getRequirementAnomalies(requirement, locale)),
    [locale, visibleRequirements],
  );

  const dismissedAnomalyIds = useMemo(
    () => new Set(dismissedAnomalies.map((item) => item.id)),
    [dismissedAnomalies],
  );

  const visibleWorkspaceAnomalies = useMemo(
    () => workspaceAnomalies.filter((item) => !dismissedAnomalyIds.has(item.id)),
    [dismissedAnomalyIds, workspaceAnomalies],
  );

  const selectedRequirementAnomalies = useMemo(
    () => (selectedRequirement ? getRequirementAnomalies(selectedRequirement, locale) : []),
    [locale, selectedRequirement],
  );

  const visibleProjects = useMemo(
    () => (runtimeMode === "github-direct" ? buildRemoteProjects(visibleTasks) : mergeProjectStats(projects, visibleTasks)),
    [projects, runtimeMode, visibleTasks],
  );

  const filteredProjects = useMemo(
    () =>
      visibleProjects.filter(
        (project) =>
          projectStatusFilter === STATUS_FILTER_ALL
          || visibleRequirements.some(
            (requirement) => requirement.projectId === project.id && matchesStatusFilter(requirement.status, projectStatusFilter),
          ),
      ),
    [projectStatusFilter, visibleProjects, visibleRequirements],
  );

  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === selectedProjectId) ?? null,
    [selectedProjectId, visibleProjects],
  );

  const selectedProjectRequirements = useMemo(
    () => visibleRequirements.filter((requirement) => requirement.projectId === selectedProjectId),
    [selectedProjectId, visibleRequirements],
  );

  const filteredSelectedProjectRequirements = useMemo(
    () => selectedProjectRequirements.filter((requirement) => matchesStatusFilter(requirement.status, requirementStatusFilter)),
    [requirementStatusFilter, selectedProjectRequirements],
  );

  const t = useMemo(
    () =>
      ({
        title: locale === "zh-CN" ? "Codex 控制中台" : "Codex Control Center",
        subtitle:
          locale === "zh-CN"
            ? "项目、任务、审批与运行数据统一管理"
            : "Unified workspace for projects, tasks, approvals and usage",
        localApi: locale === "zh-CN" ? "本地服务地址：" : "Local API:",
        authDisabled:
          locale === "zh-CN"
            ? "当前服务未启用登录，可直接使用看板。"
            : "Authentication disabled by server. Dashboard is open.",
        authRequired:
          locale === "zh-CN"
            ? "未登录也可进入看板，涉及仓库自动化的操作会受限。"
            : "You can browse without sign-in; repo automation requires authentication.",
        loginButton: locale === "zh-CN" ? "GitHub 登录" : "Sign in with GitHub",
        logoutButton: locale === "zh-CN" ? "退出登录" : "Sign out",
        refresh: locale === "zh-CN" ? "刷新" : "Refresh",
        taskDetails: locale === "zh-CN" ? "任务详情" : "Task details",
        pendingApprovals: locale === "zh-CN" ? "待处理审批" : "Pending approvals",
        noTask: locale === "zh-CN" ? "请选择任务查看详情" : "Select one task to inspect",
        mobileControlTitle: locale === "zh-CN" ? "控制中心" : "Control center",
        mobileControlMeta: locale === "zh-CN" ? "设置与账户" : "Settings & account",
        mobileViewDrawerTitle: locale === "zh-CN" ? "工作区视图" : "Workspace views",
        openViewDrawer: locale === "zh-CN" ? "切换工作区视图" : "Switch workspace view",
        themeSetting: locale === "zh-CN" ? "主题色" : "Theme",
        languageSetting: locale === "zh-CN" ? "界面语言" : "Language",
      }) satisfies Record<string, string>,
    [locale],
  );

  const memberUsageSnapshot = useMemo(() => {
    if (!usage) return null;
    const hasQuotaNumbers = usage.memberUsageUsed !== null && usage.memberUsageUsed !== undefined
      && usage.memberUsageTotal !== null && usage.memberUsageTotal !== undefined;
    const safeRatio = usage.memberUsageRatio !== null && usage.memberUsageRatio !== undefined
      ? Math.min(Math.max(usage.memberUsageRatio, 0), 1)
      : hasQuotaNumbers && usage.memberUsageTotal! > 0
        ? Math.min(Math.max((usage.memberUsageUsed as number) / (usage.memberUsageTotal as number), 0), 1)
        : null;

    if (!hasQuotaNumbers) {
      return {
        available: false,
        reason:
          usage.memberUsageReason ||
          (locale === "zh-CN"
            ? "接口未返回当前会员的算力总量或已用值。"
            : "The API did not return the current member quota total or used value."),
        label: locale === "zh-CN" ? "暂无会员算力数据" : "Member quota unavailable",
      };
    }

    const unitSuffix = usage.memberUsageUnit ? ` ${usage.memberUsageUnit}` : "";
    return {
      available: true,
      reason: "",
      label:
        locale === "zh-CN"
          ? `${usage.memberUsageUsed}${unitSuffix} / ${usage.memberUsageTotal}${unitSuffix}`
          : `${usage.memberUsageUsed}${unitSuffix} / ${usage.memberUsageTotal}${unitSuffix}`,
      ratio: safeRatio ?? 0,
      percent: `${Math.round((safeRatio ?? 0) * 100)}%`,
    };
  }, [locale, usage]);

  const memberUsagePercentText =
    memberUsageSnapshot && memberUsageSnapshot.available ? String(memberUsageSnapshot.percent || "0%") : "0%";
  const memberUsagePercentValue = Number(memberUsagePercentText.replace("%", ""));
  const usageLimitSnapshots = useMemo(() => {
    const primary = usage?.rateLimits?.primary;
    const secondary = usage?.rateLimits?.secondary;

    return [
      {
        key: "primary",
        title: "5h limit",
        subtitle: locale === "zh-CN" ? "主窗口" : "Primary window",
        snapshot: primary,
      },
      {
        key: "secondary",
        title: "Weekly limit",
        subtitle: locale === "zh-CN" ? "周窗口" : "Secondary window",
        snapshot: secondary,
      },
    ].map((item) => {
      const percent = item.snapshot?.usedPercent ?? null;
      const clampedPercent = percent === null ? 0 : Math.max(0, Math.min(percent, 100));
      const resetText = item.snapshot?.resetsAt
        ? formatUsageLimitReset(item.snapshot.resetsAt, locale)
        : locale === "zh-CN"
          ? "接口未返回重置时间"
          : "The API did not return a reset time";
      return {
        ...item,
        available: Boolean(item.snapshot),
        percentLabel: percent === null
          ? locale === "zh-CN" ? "暂无百分比" : "No percentage"
          : `${Math.round(clampedPercent)}%`,
        progressValue: clampedPercent,
        resetText,
        detail: item.snapshot?.windowMinutes
          ? locale === "zh-CN"
            ? `${item.snapshot.windowMinutes} 分钟窗口`
            : `${item.snapshot.windowMinutes} minute window`
          : item.subtitle,
        sourceLabel: item.snapshot?.sourceLabel || "",
      };
    });
  }, [locale, usage]);

  useEffect(() => {
    localStorage.setItem("codex.locale", locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem("codex.theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsMobileViewDrawerOpen(false);
  }, [activeTab, locale, theme]);

  useEffect(() => {
    void refreshAll();
    const interval = window.setInterval(() => {
      void refreshTasks();
      void refreshApprovals();
      void refreshUsage();
      void refreshAuth();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [sessionToken, githubToken]);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!visibleProjects.length) {
      setSelectedProjectId("");
      setSelectedRequirementId("");
      setSelectedTaskId("");
      setWorkspaceLevel("projects");
      return;
    }

    if (!selectedProjectId) return;

    if (!visibleProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(visibleProjects[0].id);
      setWorkspaceLevel("projects");
    }
  }, [selectedProjectId, visibleProjects]);

  useEffect(() => {
    if (!visibleRequirements.length) {
      setSelectedRequirementId("");
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (!selectedRequirementId) return;

    const nextRequirement = visibleRequirements.find((requirement) => requirement.id === selectedRequirementId);
    if (!nextRequirement) {
      setSelectedRequirementId("");
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (nextRequirement.projectId !== selectedProjectId) {
      setSelectedProjectId(nextRequirement.projectId);
    }
    if (nextRequirement.latestAttemptId !== selectedTaskId) {
      setSelectedTaskId(nextRequirement.latestAttemptId);
    }
  }, [selectedProjectId, selectedRequirementId, selectedTaskId, visibleRequirements, workspaceLevel]);

  useEffect(() => {
    if (!optimisticTasks.length) return;
    const resolvedIssueNumbers = new Set(tasks.map((task) => task.issueNumber).filter((value): value is number => typeof value === "number"));
    const resolvedKeys = new Set(tasks.map((task) => `${task.projectId}::${task.type}::${task.title}::${task.description}`));
    setOptimisticTasks((current) =>
      current.filter((task) => {
        if (typeof task.issueNumber === "number" && resolvedIssueNumbers.has(task.issueNumber)) {
          return false;
        }
        return !resolvedKeys.has(`${task.projectId}::${task.type}::${task.title}::${task.description}`);
      }),
    );
  }, [optimisticTasks.length, tasks]);

  useEffect(() => {
    localStorage.setItem(CLOSED_ANOMALIES_STORAGE_KEY, JSON.stringify(dismissedAnomalies));
  }, [dismissedAnomalies]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${DEFAULT_API_BASE}${path}`, {
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

  async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!githubToken) {
      throw new Error(locale === "zh-CN" ? "请先使用 GitHub 登录" : "Sign in with GitHub first");
    }
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message || `GitHub API failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  function summarizeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function setTransientNotice(message: string, tone: NoticeTone = "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 4500);
  }

  function dismissAnomaly(anomaly: WorkspaceAnomaly) {
    setDismissedAnomalies((current) => {
      if (current.some((item) => item.id === anomaly.id)) return current;
      return [
        {
          id: anomaly.id,
          dismissedAt: new Date().toISOString(),
        },
        ...current,
      ];
    });
    setTransientNotice(locale === "zh-CN" ? "异常已标记为已处理，不再提示" : "Anomaly marked handled and hidden from alerts", "success");
  }

  async function refreshAll() {
    await Promise.all([refreshHealth(), refreshAuth(), refreshProjects(), refreshTasks(), refreshApprovals(), refreshTools(), refreshUsage()]);
  }

  async function refreshHealth() {
    if (runtimeMode === "github-direct") {
      setConnectionStatus(
        locale === "zh-CN"
          ? `GitHub Issue 队列模式 · ${GITHUB_TASK_REPO}`
          : `GitHub issue queue mode · ${GITHUB_TASK_REPO}`,
      );
      setPlatformHealth({
        generatedAt: new Date().toISOString(),
        taskBackend: "github-issues",
        githubTaskRepo: GITHUB_TASK_REPO,
        issuePoller: {
          enabled: false,
          status: githubToken ? "remote" : "unauthenticated",
          intervalMs: 30000,
          inFlight: false,
          lastStartedAt: "",
          lastSuccessAt: "",
          lastDurationMs: 0,
          lastError: githubToken ? "" : (locale === "zh-CN" ? "GitHub Token 未连接。" : "GitHub token not connected."),
        },
        githubApi: {
          inFlight: 0,
          queued: 0,
          lastRequestAt: "",
          lastError: "",
          lastRateLimitAt: "",
          lastRetryAt: "",
          remaining: null,
          resetAt: "",
        },
        publishing: {
          lastPublishedAt: "",
          lastPublishedTaskId: "",
          lastPublishedTaskTitle: "",
          lastPublishMethod: "",
          lastPublishError: "",
          publishedTasks: visibleTasks.filter((task) => task.publishStatus === "published").length,
          noopTasks: visibleTasks.filter((task) => task.publishStatus === "noop").length,
          publishFailedTasks: visibleTasks.filter((task) => task.status === "publish_failed").length,
          completedWithoutVerifiedPublish: visibleTasks.filter((task) => task.status === "completed" && task.publishStatus !== "published" && task.publishStatus !== "noop").length,
        },
        taskState: {
          total: visibleTasks.length,
          running: visibleTasks.filter((task) => task.status === "running").length,
          waitingUser: visibleTasks.filter((task) => task.status === "waiting_user").length,
          awaitingAcceptance: visibleTasks.filter((task) => task.status === "awaiting_acceptance").length,
          needsRevision: visibleTasks.filter((task) => task.status === "needs_revision").length,
          publishFailed: visibleTasks.filter((task) => task.status === "publish_failed").length,
          stoppedLatest: visibleRequirements.filter((requirement) => requirement.status === "stopped").length,
        },
        anomalies: [
          {
            id: "completed_without_verified_publish",
            severity: "medium",
            count: visibleTasks.filter((task) => task.status === "completed" && task.publishStatus !== "published" && task.publishStatus !== "noop").length,
            description: locale === "zh-CN" ? "已完成但未带可验证发布结果的任务。" : "Completed tasks without a verified publish result.",
            taskIds: visibleTasks
              .filter((task) => task.status === "completed" && task.publishStatus !== "published" && task.publishStatus !== "noop")
              .slice(0, 10)
              .map((task) => task.id),
          },
        ],
      });
      return;
    }
    try {
      const [payload, platform] = await Promise.all([
        api<{ serverName: string; host: string }>("/api/health"),
        api<{ health: PlatformHealth }>("/api/platform-health"),
      ]);
      setConnectionStatus(
        locale === "zh-CN"
          ? `已连接 ${payload.serverName} @ ${payload.host}`
          : `Connected to ${payload.serverName} @ ${payload.host}`,
      );
      setPlatformHealth(platform.health);
    } catch (error) {
      setConnectionStatus(summarizeError(error));
      setPlatformHealth(null);
    }
  }

  async function refreshAuth() {
    if (runtimeMode === "github-direct") {
      if (!GITHUB_CLIENT_ID) {
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: false,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: null,
        });
        setAuthStatus(locale === "zh-CN" ? "请连接可写入 issue 的 GitHub Token。" : "Connect a GitHub token with issue access.");
        return;
      }

      if (!githubToken) {
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: true,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: null,
        });
        setAuthStatus(locale === "zh-CN" ? "请连接 GitHub Token 后直接提交 Issue 任务。" : "Connect a GitHub token to create and control issue tasks.");
        return;
      }

      try {
        const user = await githubRequest<{ login: string; name: string }>("/user");
        setAuthConfig({
          enabled: true,
          mode: "github-token",
          provider: "github",
          hasClientId: true,
          repoAutomationEnabled: true,
          taskBackend: "github-issues",
          githubTaskRepo: GITHUB_TASK_REPO,
          user: {
            login: user.login,
            name: user.name || user.login,
          },
        });
        setAuthStatus(locale === "zh-CN" ? `当前用户：${user.name || user.login}` : `Signed in as ${user.name || user.login}`);
      } catch (error) {
        localStorage.removeItem("codex.githubAccessToken");
        setGithubToken("");
        setAuthStatus(summarizeError(error));
      }
      return;
    }
    try {
      const payload = await api<AuthConfig>("/api/auth/config");
      setAuthConfig(payload);
      if (!payload.enabled) {
        setAuthStatus(t.authDisabled);
      } else if (payload.user) {
        const username = payload.user.name || payload.user.login;
        setAuthStatus(locale === "zh-CN" ? `当前用户：${username}` : `Signed in as ${username}`);
      } else {
        setAuthStatus(t.authRequired);
      }
    } catch (error) {
      setAuthStatus(summarizeError(error));
    }
  }

  async function refreshProjects() {
    if (runtimeMode === "github-direct") {
      const nextProjects = buildRemoteProjects(tasks);
      setProjects(nextProjects);
      if (!nextProjects.length) {
        setSelectedProjectId("");
        return;
      }
      const currentProjectId = selectedProjectIdRef.current;
      const nextProjectId = nextProjects.some((project) => project.id === currentProjectId)
        ? currentProjectId
        : nextProjects[0].id;
      if (nextProjectId !== currentProjectId) {
        setSelectedProjectId(nextProjectId);
      }
      return;
    }
    try {
      const payload = await api<{ projects: Project[] }>("/api/projects");
      setProjects(payload.projects);

      if (!payload.projects.length) {
        setSelectedProjectId("");
        return;
      }

      const currentProjectId = selectedProjectIdRef.current;
      const nextProjectId = payload.projects.some((project) => project.id === currentProjectId)
        ? currentProjectId
        : payload.projects[0].id;

      if (nextProjectId !== currentProjectId) {
        setSelectedProjectId(nextProjectId);
      }
    } catch {
      setProjects([]);
    }
  }

  async function refreshTasks() {
    if (runtimeMode === "github-direct") {
      if (!githubToken) {
        setTasks([]);
        setApprovals([]);
        setUsage(null);
        setProjects(buildRemoteProjects([]));
        return;
      }

      try {
        const [owner, repo] = GITHUB_TASK_REPO.split("/");
        const issues = await githubRequest<Array<{
          number: number;
          title: string;
          body: string;
          state: string;
          html_url: string;
          updated_at: string;
          labels: Array<{ name: string }>;
          pull_request?: unknown;
        }>>(`/repos/${owner}/${repo}/issues?state=all&labels=codex-task&per_page=100&sort=updated&direction=desc`);

        const taskList = (
          await Promise.all(
            issues
              .filter((issue) => !issue.pull_request)
              .map(async (issue) => {
                const parsed = parseIssueBody(issue.body || "");
                const comments = await githubRequest<IssueComment[]>(
                  `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100&sort=created&direction=asc`,
                );
                const statusMeta = parseStatusFromComments(comments, issue.state === "closed");
                const logs = buildLogsFromComments(comments);
                const projectId = parsed.projectId || "dashboard-ui";
                return {
                  id: statusMeta.taskId || `issue-${issue.number}`,
                  issueNumber: issue.number,
                  issueUrl: issue.html_url,
                  projectId,
                  projectName: getProjectDisplayName(projectId, locale),
                  type: parsed.type,
                  title: parsed.title || issue.title,
                  description: parsed.description || issue.body || "",
                  status: statusMeta.status,
                  summary: statusMeta.summary,
                  userSummary: statusMeta.summary,
                  planPreview: "",
                  workspacePath: "",
                  branchName: "",
                  logs,
                  children: [],
                } satisfies Task;
              }),
          )
        ).sort((left, right) => (right.issueNumber || 0) - (left.issueNumber || 0));

        setTasks(taskList);
        setOptimisticTasks((current) =>
          current.filter((task) => !(typeof task.issueNumber === "number" && taskList.some((item) => item.issueNumber === task.issueNumber))),
        );
        setProjects(buildRemoteProjects(taskList));
        setApprovals(
          taskList
            .filter((task) => task.status === "waiting_user")
            .map((task) => ({
              id: `approval-${task.issueNumber || task.id}`,
              reason: locale === "zh-CN" ? "请在 GitHub Pages 审批后继续执行" : "Approve in GitHub Pages to continue execution",
              task,
            })),
        );
        setUsage({
          totalTasks: taskList.length,
          activeTasks: taskList.filter((task) => task.status === "running").length,
          pendingApprovals: taskList.filter((task) => task.status === "waiting_user").length,
          completedTasks: taskList.filter((task) => task.status === "completed").length,
          failedTasks: taskList.filter((task) => task.status === "failed").length,
          estimatedTokens: 0,
          totalRuns: taskList.length,
          lastRunAt: issues[0]?.updated_at || "",
          memberUsageReason:
            locale === "zh-CN"
              ? "GitHub Pages 直连模式只能统计任务数据，无法读取当前会员算力配额。"
              : "GitHub Pages direct mode can summarize task activity, but cannot read the current member quota.",
        });
        setUsageSummary(
          locale === "zh-CN"
            ? "当前处于 GitHub Pages 直连模式，已展示任务运行统计；会员算力已用/总量依赖后端配额接口，当前不可用。"
            : "GitHub Pages direct mode can show task activity, but member used/total quota depends on a backend quota endpoint and is unavailable here.",
        );

        if (!taskList.length) {
          setSelectedTaskId("");
          return;
        }
        const currentTaskId = selectedTaskIdRef.current;
        const nextTaskId = taskList.some((task) => task.id === currentTaskId) ? currentTaskId : taskList[0].id;
        if (currentTaskId && nextTaskId !== currentTaskId) {
          setSelectedTaskId(nextTaskId);
        }
      } catch {
        setTasks([]);
        setApprovals([]);
      }
      return;
    }
    try {
      const payload = await api<{ tasks: Task[] }>("/api/tasks");
      setTasks(payload.tasks);

      if (!payload.tasks.length) {
        setSelectedTaskId("");
        return;
      }

      const currentTaskId = selectedTaskIdRef.current;
      const nextTaskId = payload.tasks.some((task) => task.id === currentTaskId)
        ? currentTaskId
        : payload.tasks[0].id;

      if (!currentTaskId) return;
      if (nextTaskId !== currentTaskId) {
        setSelectedTaskId(nextTaskId);
      }
    } catch {
      setTasks([]);
    }
  }

  async function refreshApprovals() {
    if (runtimeMode === "github-direct") {
      return;
    }
    try {
      const payload = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(payload.approvals.filter((approval) => approval.task.status === "waiting_user"));
    } catch {
      setApprovals([]);
    }
  }

  async function refreshTools() {
    if (runtimeMode === "github-direct") {
      setTools(
        REMOTE_PROJECT_CATALOG.map((project) => ({
          id: project.id,
          name: getProjectDisplayName(project.id, locale),
          route: project.repository,
          description: project.description,
        })),
      );
      return;
    }
    try {
      const payload = await api<{ tools: Array<{ id: string; name: string; route: string; description: string }> }>("/api/tools");
      setTools(payload.tools);
    } catch {
      setTools([]);
    }
  }

  async function refreshUsage() {
    if (runtimeMode === "github-direct") {
      return;
    }
    try {
      const payload = await api<{ overview: UsageOverview }>("/api/usage");
      const normalized = normalizeUsageOverview(payload.overview);
      setUsage(normalized);
      const hasMemberUsage = normalized.memberUsageUsed !== null && normalized.memberUsageTotal !== null;
      const statusSnapshotTime = normalized.statusCollectedAt
        ? new Date(normalized.statusCollectedAt).toLocaleString(locale, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      setUsageSummary(
        hasMemberUsage
          ? locale === "zh-CN"
            ? `当前会员算力已使用 ${normalized.memberUsageUsed}${normalized.memberUsageUnit ? ` ${normalized.memberUsageUnit}` : ""}，总量 ${normalized.memberUsageTotal}${normalized.memberUsageUnit ? ` ${normalized.memberUsageUnit}` : ""}。`
            : `Current member quota used: ${normalized.memberUsageUsed}${normalized.memberUsageUnit ? ` ${normalized.memberUsageUnit}` : ""} out of ${normalized.memberUsageTotal}${normalized.memberUsageUnit ? ` ${normalized.memberUsageUnit}` : ""}.`
          : normalized.memberUsageReason ||
            (locale === "zh-CN"
              ? `已拿到运行统计${statusSnapshotTime ? `，最近一次 CLI 状态快照时间为 ${statusSnapshotTime}` : ""}，但接口没有返回当前会员的算力已用/总量。`
              : `Runtime statistics loaded${statusSnapshotTime ? ` from the latest CLI status snapshot at ${statusSnapshotTime}` : ""}, but the API did not return current member used/total quota.`),
      );
    } catch (error) {
      setUsage(null);
      setUsageSummary(
        locale === "zh-CN"
          ? `无法获取用量概览：${summarizeError(error)}`
          : `Unable to load usage overview: ${summarizeError(error)}`,
      );
    }
  }

  async function onCreateProject(formElement: HTMLFormElement) {
    try {
      const form = new FormData(formElement);
      const name = String(form.get("name") || "").trim();
      const description = String(form.get("description") || "").trim();
      const repository = String(form.get("repository") || "").trim();
      const visibility = String(form.get("visibility") || "private");
      const autoCreateRepo = form.get("autoCreateRepo") === "on";

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = {
          projectId: "dashboard-ui",
          type: "project_create",
          title: `Create project: ${name}`,
          description: description || `Create a new Codex-managed project named ${name}.`,
          requestedProject: {
            id: slugify(name),
            name,
            description,
            repository,
            visibility,
            autoCreateRepo,
          },
        };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            body: [
              `project: ${payload.projectId}`,
              `type: ${payload.type}`,
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
        setTransientNotice(
          locale === "zh-CN" ? `项目请求已入队：Issue #${issue.number}` : `Project queued via issue #${issue.number}`,
          "success",
        );
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId: "dashboard-ui",
            type: "project_create",
            title: `Create project: ${name}`,
            description: description || `Create a new Codex-managed project named ${name}.`,
            requestedProject: {
              id: slugify(name),
              name,
              description,
              repository,
              visibility,
              autoCreateRepo,
            },
          }),
        });
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
            description,
            repository,
            visibility,
            autoCreateRepo,
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "项目已创建" : "Project created", "success");
      }
      formElement.reset();
      setCreateDialogMode(null);
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function onCreateTask(formElement: HTMLFormElement) {
    try {
      const form = new FormData(formElement);
      const type = String(form.get("type") || "task").trim();
      const projectId = getTaskProjectId(type, String(form.get("projectId") || "").trim());
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();
      let createdTask: Task | null = null;

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = { projectId, type, title, description };
        const issue = await githubRequest<{ number: number; html_url: string }>(`/repos/${owner}/${repoName}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body: [
              `project: ${projectId}`,
              `type: ${type}`,
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
        createdTask = {
          id: `pending-issue-${issue.number}`,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          projectId,
          projectName: getProjectDisplayName(projectId, locale),
          type,
          title,
          description,
          status: "pending_capture",
          summary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
        setTransientNotice(locale === "zh-CN" ? `任务已入队：Issue #${issue.number}` : `Task queued via issue #${issue.number}`, "success");
      } else if (authConfig?.taskBackend === "github-issues") {
        const queued = await api<{ issue: IssueTask }>("/api/issue-tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            type,
            title,
            description,
          }),
        });
        createdTask = {
          id: `pending-issue-${queued.issue.number}`,
          issueNumber: queued.issue.number,
          issueUrl: queued.issue.url,
          projectId,
          projectName: getProjectDisplayName(projectId, locale),
          type,
          title,
          description,
          status: "pending_capture",
          summary: "",
          planPreview: "",
          workspacePath: "",
          branchName: "",
          logs: [],
          children: [],
        };
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
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "任务已创建" : "Task created", "success");
      }
      if (createdTask) {
        setOptimisticTasks((current) => [createdTask as Task, ...current.filter((task) => task.id !== createdTask!.id)]);
        setSelectedProjectId(projectId);
        setSelectedTaskId(createdTask.id);
        setWorkspaceLevel("tasks");
      }
      formElement.reset();
      setCreateDialogMode(null);
      await refreshTasks();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function loginWithGithub() {
    if (runtimeMode === "github-direct") {
      const token = window.prompt(
        locale === "zh-CN"
          ? "输入一个可访问仓库 issue 的 GitHub Token。建议使用 fine-grained token，并授予 Issues 读写、Metadata 读取权限。"
          : "Paste a GitHub token with repository issue access. A fine-grained token with Issues read/write and Metadata read is recommended.",
        githubToken,
      );
      const normalized = String(token || "").trim();
      if (!normalized) {
        return;
      }

      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${normalized}`,
          },
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message || "Invalid GitHub token");
        }
        localStorage.setItem("codex.githubAccessToken", normalized);
        setGithubToken(normalized);
        setTransientNotice(locale === "zh-CN" ? "GitHub 已连接" : "GitHub connected", "success");
        await refreshAll();
      } catch (error) {
        setTransientNotice(summarizeError(error), "error");
      }
      return;
    }

    if (!authConfig?.enabled || authConfig.mode !== "github-device") {
      setTransientNotice(locale === "zh-CN" ? "服务器未启用 GitHub 设备流登录" : "GitHub device flow is not enabled");
      return;
    }

    try {
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

      const session: DeviceLoginSession = {
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        expiresAt: Date.now() + device.expires_in * 1000,
        intervalSec: device.interval || 5,
        status: locale === "zh-CN" ? "等待你在 GitHub 输入验证码..." : "Waiting for authorization on GitHub...",
        error: "",
      };
      setDeviceLogin(session);
      const myPollToken = ++pollTokenRef.current;
      void pollDeviceLogin(session, myPollToken);
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function pollDeviceLogin(session: DeviceLoginSession, pollToken: number) {
    while (Date.now() < session.expiresAt) {
      if (pollToken !== pollTokenRef.current) return;
      await sleep(session.intervalSec * 1000);
      try {
        const polled = runtimeMode === "github-direct"
          ? await fetch("https://github.com/login/oauth/access_token", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: GITHUB_CLIENT_ID,
                device_code: session.deviceCode,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              }),
            }).then((response) => response.json() as Promise<{
              access_token?: string;
              error?: string;
              error_description?: string;
              interval?: number;
            }>)
          : await api<{
              sessionToken?: string;
              error?: string;
              error_description?: string;
            }>("/api/auth/device/poll", {
              method: "POST",
              body: JSON.stringify({ deviceCode: session.deviceCode }),
            });

        if ("access_token" in polled && polled.access_token) {
          localStorage.setItem("codex.githubAccessToken", polled.access_token);
          setGithubToken(polled.access_token);
          setDeviceLogin((prev) =>
            prev
              ? {
                  ...prev,
                  status: locale === "zh-CN" ? "登录成功，正在刷新界面..." : "Signed in. Refreshing dashboard...",
                }
              : prev,
          );
          await refreshAll();
          window.setTimeout(() => setDeviceLogin(null), 1200);
          return;
        }

        if ("sessionToken" in polled && polled.sessionToken) {
          localStorage.setItem("codex.sessionToken", polled.sessionToken);
          setSessionToken(polled.sessionToken);
          setDeviceLogin((prev) =>
            prev
              ? {
                  ...prev,
                  status: locale === "zh-CN" ? "登录成功，正在刷新界面..." : "Signed in. Refreshing dashboard...",
                }
              : prev,
          );
          await refreshAll();
          window.setTimeout(() => setDeviceLogin(null), 1200);
          return;
        }

        if (polled.error && polled.error !== "authorization_pending" && polled.error !== "slow_down") {
          throw new Error(polled.error_description || polled.error);
        }
      } catch (error) {
        setDeviceLogin((prev) =>
          prev
            ? {
                ...prev,
                error: summarizeError(error),
                status: locale === "zh-CN" ? "登录失败，请重试" : "Login failed. Please retry.",
              }
            : prev,
        );
        return;
      }
    }

    setDeviceLogin((prev) =>
      prev
        ? {
            ...prev,
            status: locale === "zh-CN" ? "设备码已过期，请重新发起登录" : "Device code expired. Start again.",
          }
        : prev,
    );
  }

  async function copyDeviceCode() {
    if (!deviceLogin) return;
    try {
      await navigator.clipboard.writeText(deviceLogin.userCode);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setTransientNotice(locale === "zh-CN" ? "复制失败，请手动复制" : "Clipboard copy failed. Copy manually.", "error");
    }
  }

  function cancelDeviceLogin() {
    pollTokenRef.current += 1;
    setDeviceLogin(null);
  }

  async function logout() {
    if (runtimeMode === "github-direct") {
      pollTokenRef.current += 1;
      localStorage.removeItem("codex.githubAccessToken");
      setGithubToken("");
      setDeviceLogin(null);
      await refreshAll();
      return;
    }
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Ignore server-side logout failure, local token is still cleared.
    } finally {
      pollTokenRef.current += 1;
      localStorage.removeItem("codex.sessionToken");
      setSessionToken("");
      setDeviceLogin(null);
      await refreshAll();
    }
  }

  async function mutateTask(taskId: string, action: "stop" | "retry") {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (runtimeMode === "github-direct") {
        if (!task?.issueNumber) {
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
      setTransientNotice(
        action === "stop" ? (locale === "zh-CN" ? "已发送停止指令" : "Stop requested") : locale === "zh-CN" ? "已重试任务" : "Task retried",
        "success",
      );
      await refreshTasks();
      await refreshApprovals();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function respondToTask(taskId: string, decision: "approve" | "reject", feedback: string) {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (runtimeMode === "github-direct") {
        if (!task?.issueNumber) {
          throw new Error(locale === "zh-CN" ? "当前任务没有对应的 Issue 编号" : "This task is missing an issue number");
        }
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const command = decision === "approve" ? `/approve ${feedback}`.trim() : `/reject ${feedback}`.trim();
        await githubRequest(`/repos/${owner}/${repoName}/issues/${task.issueNumber}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: command }),
        });
      } else {
        await api(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          body: JSON.stringify({ decision, feedback }),
        });
      }
      setTransientNotice(locale === "zh-CN" ? "审批结果已提交" : "Decision submitted", "success");
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedRequirementId("");
    setWorkspaceLevel("tasks");
  }

  function openRequirement(requirement: Requirement) {
    setSelectedProjectId(requirement.projectId);
    setSelectedRequirementId(requirement.id);
    setSelectedTaskId(requirement.latestAttemptId);
    setWorkspaceLevel("detail");
  }

  const breadcrumbs = [
    { key: "projects", label: locale === "zh-CN" ? "项目" : "Projects", active: workspaceLevel === "projects", onClick: () => setWorkspaceLevel("projects") },
    ...(selectedProject
      ? [
          {
            key: "tasks",
            label: getProjectDisplayName(selectedProject.id, locale),
            active: workspaceLevel === "tasks",
            onClick: () => {
              setSelectedProjectId(selectedProject.id);
              setWorkspaceLevel("tasks");
            },
          },
        ]
      : []),
    ...(selectedRequirement
      ? [
          {
            key: "detail",
            label: selectedRequirement.title,
            active: workspaceLevel === "detail",
            onClick: () => {
              openRequirement(selectedRequirement);
            },
          },
        ]
      : []),
  ];

  const workspaceTitle =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "项目列表"
        : "Projects"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "需求列表"
          : "Requirements"
        : t.taskDetails;

  const workspaceDescription =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "先选择项目，再进入对应任务列表。"
        : "Choose a project first, then inspect its tasks."
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? `${getProjectDisplayName(selectedProject?.id || "", locale) || "当前项目"} 下的需求线程`
          : `Requirement threads under ${getProjectDisplayName(selectedProject?.id || "", locale) || "the current project"}`
        : locale === "zh-CN"
          ? "展示当前需求线程的最新 attempt、验收项和失败原因。"
          : "Focused detail view for the active requirement, including attempts and acceptance.";

  const createLabel =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "新建项目"
        : "New project"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "新建任务"
          : "New task"
        : "";

  return (
      <div className="app-root">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div className="brand-copy">
            <div className="brand-title">{t.title}</div>
            <div className="brand-subtitle">{t.subtitle}</div>
          </div>
        </div>
        <div className="topbar-right">
          <HeaderSwitch
            checked={theme === "dark"}
            label={t.themeSetting}
            onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
          <HeaderLocaleSwitch
            label={t.languageSetting}
            value={locale}
            onChange={setLocale}
          />
          <button type="button" className="ghost header-logout" onClick={() => void logout()} disabled={!authConfig?.user}>
            {t.logoutButton}
          </button>
        </div>
      </header>

      {deviceLogin ? (
        <section className="device-card">
          <div className="section-head">
            <h3>{locale === "zh-CN" ? "GitHub 设备登录" : "GitHub Device Login"}</h3>
            <button type="button" className="icon-button" aria-label={locale === "zh-CN" ? "关闭" : "Close"} onClick={cancelDeviceLogin}>
              ×
            </button>
          </div>
          <p className="hint">
            {locale === "zh-CN"
              ? "请先打开下方链接，然后输入验证码。整个流程可在当前页面完成轮询。"
              : "Open the URL below and enter your code. Polling continues in this page."}
          </p>
          <div className="device-row">
            <a href={deviceLogin.verificationUri} target="_blank" rel="noreferrer">
              {deviceLogin.verificationUri}
            </a>
            <button type="button" className="primary" onClick={() => void copyDeviceCode()}>
              {copyState === "copied" ? (locale === "zh-CN" ? "已复制" : "Copied") : locale === "zh-CN" ? "复制验证码" : "Copy code"}
            </button>
          </div>
          <div className="code-box">{deviceLogin.userCode}</div>
          <div className="hint">{deviceLogin.status}</div>
          {deviceLogin.error ? <pre className="error-box">{deviceLogin.error}</pre> : null}
        </section>
      ) : null}

      {notices.length ? (
        <div className="notice-stack" aria-live="polite" aria-atomic="true">
          {notices.map((notice) => (
            <section key={notice.id} className={`notice notice-${notice.tone}`}>
              {notice.message}
            </section>
          ))}
        </div>
      ) : null}

      <nav className="tabs" aria-label="Primary">
        {tabs.map((tab) => (
          <button key={tab.id} className={tab.id === activeTab ? "tab active" : "tab"} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label[locale]}
          </button>
        ))}
        <div className="spacer" />
        {!authConfig?.user ? (
          <button
            type="button"
            className="ghost"
            onClick={() => void loginWithGithub()}
            disabled={runtimeMode === "github-direct" ? false : !authConfig?.enabled}
          >
            {t.loginButton}
          </button>
        ) : null}
      </nav>

      <div className="mobile-nav-fab">
        <button
          type="button"
          className="mobile-nav-trigger"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-nav-sheet"
          onClick={() => setIsMobileNavOpen((open) => !open)}
        >
          <span className="mobile-nav-trigger-label">{t.mobileControlTitle}</span>
          <span className="mobile-nav-trigger-meta">{t.mobileControlMeta}</span>
        </button>
      </div>

      {isMobileNavOpen ? (
        <div className="mobile-nav-backdrop" role="presentation" onClick={() => setIsMobileNavOpen(false)}>
          <div
            id="mobile-nav-sheet"
            className="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t.mobileControlTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h3>{t.mobileControlTitle}</h3>
              <button type="button" className="icon-button" aria-label={locale === "zh-CN" ? "关闭" : "Close"} onClick={() => setIsMobileNavOpen(false)}>
                ×
              </button>
            </div>
            <div className="mobile-nav-actions">
              <button type="button" className="ghost mobile-nav-action-card" onClick={() => setIsMobileViewDrawerOpen(true)}>
                <span className="mobile-nav-action-label">{t.openViewDrawer}</span>
                <span className="mobile-nav-action-hint">{tabs.find((tab) => tab.id === activeTab)?.label[locale]}</span>
              </button>
              <HeaderSwitch
                checked={theme === "dark"}
                label={t.themeSetting}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
              <HeaderLocaleSwitch
                label={t.languageSetting}
                value={locale}
                onChange={setLocale}
              />
              {!authConfig?.user ? (
                <button
                  type="button"
                  className="ghost mobile-nav-action-card"
                  onClick={() => void loginWithGithub()}
                  disabled={runtimeMode === "github-direct" ? false : !authConfig?.enabled}
                >
                  <span className="mobile-nav-action-label">{t.loginButton}</span>
                  <span className="mobile-nav-action-hint">{locale === "zh-CN" ? "连接 CodeHub / GitHub 身份" : "Connect your CodeHub / GitHub identity"}</span>
                </button>
              ) : null}
              <button type="button" className="ghost" onClick={() => void logout()} disabled={!authConfig?.user}>
                {t.logoutButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMobileViewDrawerOpen ? (
        <div className="mobile-drawer-backdrop" role="presentation" onClick={() => setIsMobileViewDrawerOpen(false)}>
          <div
            className="mobile-view-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.mobileViewDrawerTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h3>{t.mobileViewDrawerTitle}</h3>
              <button type="button" className="icon-button" aria-label={locale === "zh-CN" ? "关闭" : "Close"} onClick={() => setIsMobileViewDrawerOpen(false)}>
                ×
              </button>
            </div>
            <div className="mobile-nav-tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={tab.id === activeTab ? "tab active" : "tab"}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label[locale]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "quest-center" && (
        <section className="workspace-shell">
          <article className="card workspace-panel">
            <div className="workspace-toolbar">
              <div className="toolbar-left">
                <div className="breadcrumb-row" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb) => (
                    <div key={crumb.key} className="breadcrumb-item">
                      <button
                        type="button"
                        className={crumb.active ? "breadcrumb active" : "breadcrumb"}
                        onClick={crumb.onClick}
                      >
                        {crumb.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="toolbar-actions">
                <button className="ghost" type="button" onClick={() => void refreshAll()}>
                  {t.refresh}
                </button>
                {workspaceLevel === "projects" ? (
                  <button type="button" className="ghost" onClick={() => setCreateDialogMode("composite_task")}>
                    {locale === "zh-CN" ? "模糊/组合任务" : "Composite task"}
                  </button>
                ) : null}
                {createLabel ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setCreateDialogMode(workspaceLevel === "projects" ? "project" : "task")}
                  >
                    {createLabel}
                  </button>
                ) : null}
              </div>
            </div>

            <div className={`panel-intro ${workspaceLevel === "detail" ? "" : "panel-intro-with-filter"}`.trim()}>
              <div>
                <h2>{workspaceTitle}</h2>
                <div className="meta">{workspaceDescription}</div>
              </div>
              {workspaceLevel === "projects" ? (
                <StatusFilterBar
                  locale={locale}
                  value={projectStatusFilter}
                  onChange={setProjectStatusFilter}
                />
              ) : null}
              {workspaceLevel === "tasks" ? (
                <StatusFilterBar
                  locale={locale}
                  value={requirementStatusFilter}
                  onChange={setRequirementStatusFilter}
                />
              ) : null}
            </div>

            {workspaceLevel === "projects" ? (
              <>
                <div className="entity-grid">
                  {filteredProjects.length ? (
                    filteredProjects.map((project) => (
                      <button key={project.id} type="button" className="entity-card project-card" onClick={() => openProject(project.id)}>
                        <div className="entity-topline">
                          <span className="entity-icon" aria-hidden="true">
                            ▣
                          </span>
                          <span className="title">{getProjectDisplayName(project.id, locale)}</span>
                        </div>
                        <div className="meta clamp-2">
                          {(project.id === AUTO_ROUTE_PROJECT_ID
                            ? locale === "zh-CN"
                              ? "模糊或跨项目任务暂存区，等待 AI 判断路由。"
                              : "Staging area for composite or cross-project tasks before AI routing."
                            : project.description) || (locale === "zh-CN" ? "暂无项目描述" : "No description")}
                        </div>
                        <div className="entity-footer">
                          <span className="meta">{project.repository || (locale === "zh-CN" ? "未绑定仓库" : "No repository")}</span>
                          <span className="stats-pill">
                            {project.taskStats.running}/{project.taskStats.total}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="detail-empty">
                      {locale === "zh-CN" ? "当前筛选下暂无项目" : "No projects match this status filter"}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {workspaceLevel === "tasks" ? (
              <>
                <div className="entity-grid">
                  {filteredSelectedProjectRequirements.length ? (
                    filteredSelectedProjectRequirements.map((requirement) => (
                      <button key={requirement.id} type="button" className="entity-card task-card" onClick={() => openRequirement(requirement)}>
                        <div className="entity-topline">
                          <span className="title clamp-2">{requirement.title}</span>
                          <span className={`badge status-${requirement.status}`}>{statusLabel[requirement.status][locale]}</span>
                        </div>
                        <div className="meta">
                          {getProjectDisplayName(requirement.projectId, locale)} · attempt #{requirement.latestAttemptNumber}
                        </div>
                        <div className="meta">
                          {locale === "zh-CN" ? "验收：" : "Acceptance: "}
                          {requirement.acceptanceCompleted}/{requirement.acceptanceTotal}
                          {requirement.publishStatus ? ` · ${requirement.publishStatus}` : ""}
                        </div>
                        <div className="entity-copy entity-preview wrap-anywhere clamp-3">{getRequirementPreview(requirement, locale)}</div>
                      </button>
                    ))
                  ) : (
                    <div className="detail-empty">
                      {locale === "zh-CN" ? "当前筛选下暂无需求" : "No requirements match this status filter"}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {workspaceLevel === "detail" ? (
              selectedTask && selectedRequirement ? (
                <TaskDetail
                  requirement={selectedRequirement}
                  task={selectedTask}
                  locale={locale}
                  onMutate={mutateTask}
                  onRespond={respondToTask}
                  anomalies={selectedRequirementAnomalies}
                  dismissedAnomalyIds={dismissedAnomalyIds}
                  onDismissAnomaly={dismissAnomaly}
                />
              ) : (
                <div className="detail-empty">{t.noTask}</div>
              )
            ) : null}
          </article>

          <article className="card side-panel approval-panel">
            <div className="section-head">
              <h2>{t.pendingApprovals}</h2>
              <button className="ghost" type="button" onClick={() => void refreshApprovals()}>
                {t.refresh}
              </button>
            </div>
            <div className="stack">
              {approvals.length ? (
                approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    locale={locale}
                    onRespond={respondToTask}
                    onOpenTask={(taskId) => {
                      const task = visibleTasks.find((item) => item.id === taskId);
                      if (!task) return;
                      const requirement = visibleRequirements.find((item) => item.latestAttemptId === task.id || item.attempts.some((attempt) => attempt.id === task.id));
                      if (!requirement) return;
                      openRequirement(requirement);
                    }}
                  />
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "当前没有待审批" : "No pending approvals"}</div>
              )}
            </div>
            <div className="section-head" style={{ marginTop: "1.25rem" }}>
              <h2>{locale === "zh-CN" ? "异常队列" : "Anomaly queue"}</h2>
            </div>
            <div className="stack">
              {visibleWorkspaceAnomalies.length ? (
                visibleWorkspaceAnomalies.map((item) => (
                  <div key={item.id} className="entity-card task-card anomaly-card">
                    <button
                      type="button"
                      className="anomaly-open"
                      onClick={() => {
                        const task = visibleTasks.find((candidate) => candidate.id === item.taskId);
                        if (!task) return;
                        const requirement = visibleRequirements.find((candidate) => candidate.latestAttemptId === task.id || candidate.attempts.some((attempt) => attempt.id === task.id));
                        if (!requirement) return;
                        openRequirement(requirement);
                      }}
                    >
                      <div className="entity-topline">
                        <span className="title clamp-2">{item.title}</span>
                        <span className={`badge status-${item.status}`}>{statusLabel[item.status][locale]}</span>
                      </div>
                      <div className="entity-copy entity-preview wrap-anywhere clamp-3">{item.detail}</div>
                    </button>
                    <div className="action-row">
                      <button type="button" className="ghost" onClick={() => dismissAnomaly(item)}>
                        {locale === "zh-CN" ? "标记已处理" : "Mark handled"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "当前没有异常需求" : "No anomalies"}</div>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "tools" && (
        <section className="single-panel">
          <article className="card">
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "工具路由" : "Tool routes"}</h2>
            </div>
            <div className="stack">
              {tools.length ? (
                tools.map((tool) => (
                  <div key={tool.id} className="tool-item">
                    <div className="title">{tool.name}</div>
                    <div className="meta">{tool.description || (locale === "zh-CN" ? "无描述" : "No description")}</div>
                    <a className="meta link wrap-anywhere" href={tool.route} target="_blank" rel="noreferrer">
                      {locale === "zh-CN" ? `打开 ${tool.route}` : `Open ${tool.route}`}
                    </a>
                  </div>
                ))
              ) : (
                <div className="detail-empty">{locale === "zh-CN" ? "暂无工具路由" : "No tools"}</div>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "usage" && (
        <section className="single-panel">
          <article className="card">
            <div className="section-head usage-section-head">
              <h2>{locale === "zh-CN" ? "运行用量快照" : "Usage snapshot"}</h2>
            </div>
            <div className="usage-limit-grid">
              {usageLimitSnapshots.map((item) => (
                <section key={item.key} className="usage-limit-card">
                  <div className="usage-limit-head">
                    <div>
                      <div className="meta">{item.subtitle}</div>
                      <h3>{item.title}</h3>
                    </div>
                    {item.sourceLabel ? <span className="stats-pill">{item.sourceLabel}</span> : null}
                  </div>
                  <div className="usage-limit-value">
                    {item.percentLabel}
                  </div>
                  <div
                    className="usage-progress usage-progress-tight"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.progressValue}
                    aria-label={item.title}
                  >
                    <div className="usage-progress-bar" style={{ width: `${item.progressValue}%` }} />
                  </div>
                  <div className="usage-limit-meta">
                    <span>{item.available ? item.detail : (locale === "zh-CN" ? "当前接口暂无该窗口数据" : "This API does not currently expose this window")}</span>
                    <span>{item.resetText}</span>
                  </div>
                </section>
              ))}
            </div>
            <div className="usage-hero">
              <div className="usage-member-card">
                <div className="meta">{locale === "zh-CN" ? "当前会员算力" : "Current member quota"}</div>
                <div className="usage-member-value">
                  {memberUsageSnapshot?.available
                    ? memberUsageSnapshot.label
                    : memberUsageSnapshot?.label || (locale === "zh-CN" ? "暂无会员算力数据" : "Member quota unavailable")}
                </div>
                <div
                  className="usage-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={memberUsagePercentValue}
                  aria-label={locale === "zh-CN" ? "会员算力用量比例" : "Member quota usage ratio"}
                >
                  <div
                    className="usage-progress-bar"
                    style={{ width: memberUsagePercentText }}
                  />
                </div>
                <div className="meta">
                  {memberUsageSnapshot?.available
                    ? locale === "zh-CN"
                      ? `已使用 ${memberUsageSnapshot.percent}`
                      : `${memberUsageSnapshot.percent} used`
                    : memberUsageSnapshot?.reason || usageSummary || (locale === "zh-CN" ? "暂无说明" : "No details")}
                </div>
              </div>
              <div className="usage-summary-card">
                <div className="meta">{locale === "zh-CN" ? "摘要" : "Summary"}</div>
                <div className="wrap-anywhere">
                  {usageSummary || (locale === "zh-CN" ? "暂无用量摘要。" : "No usage summary.")}
                </div>
              </div>
            </div>
            <div className="section-head usage-section-head">
              <h2>{locale === "zh-CN" ? "运行指标" : "Runtime metrics"}</h2>
            </div>
            <div className="usage-grid usage-grid-roomy">
              {usage
                ? [
                    [locale === "zh-CN" ? "总任务数" : "Total tasks", usage.totalTasks],
                    [locale === "zh-CN" ? "活动任务" : "Active tasks", usage.activeTasks],
                    [locale === "zh-CN" ? "待审批" : "Pending approvals", usage.pendingApprovals],
                    [locale === "zh-CN" ? "已完成" : "Completed", usage.completedTasks],
                    [locale === "zh-CN" ? "失败" : "Failed", usage.failedTasks],
                    [locale === "zh-CN" ? "预估 token" : "Token estimate", usage.estimatedTokens],
                    [locale === "zh-CN" ? "Worker 运行次数" : "Worker runs", usage.totalRuns],
                    [locale === "zh-CN" ? "最近运行" : "Last run", usage.lastRunAt || "n/a"],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="usage-item">
                      <div className="meta">{label}</div>
                      <div className="title wrap-anywhere">{String(value)}</div>
                    </div>
                  ))
                : <div className="detail-empty">{locale === "zh-CN" ? "暂无用量数据" : "No usage data"}</div>}
            </div>
            <div className="section-head usage-section-head">
              <h2>{locale === "zh-CN" ? "平台健康" : "Platform health"}</h2>
            </div>
            <div className="usage-grid">
              {platformHealth
                ? [
                    [locale === "zh-CN" ? "任务后端" : "Task backend", platformHealth.taskBackend || "n/a"],
                    [locale === "zh-CN" ? "Issue Poller" : "Issue poller", platformHealth.issuePoller.status],
                    [locale === "zh-CN" ? "轮询周期" : "Poll interval", platformHealth.issuePoller.intervalMs ? `${platformHealth.issuePoller.intervalMs}ms` : "n/a"],
                    [locale === "zh-CN" ? "最近成功轮询" : "Last poll success", platformHealth.issuePoller.lastSuccessAt || "n/a"],
                    [locale === "zh-CN" ? "GitHub API 余量" : "GitHub API remaining", platformHealth.githubApi.remaining ?? "n/a"],
                    [locale === "zh-CN" ? "最近发布方式" : "Last publish method", platformHealth.publishing.lastPublishMethod || "n/a"],
                    [locale === "zh-CN" ? "待验收需求" : "Awaiting acceptance", platformHealth.taskState.awaitingAcceptance],
                    [locale === "zh-CN" ? "待返修需求" : "Needs revision", platformHealth.taskState.needsRevision + platformHealth.taskState.publishFailed],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="usage-item">
                      <div className="meta">{label}</div>
                      <div className="title wrap-anywhere">{String(value)}</div>
                    </div>
                  ))
                : <div className="detail-empty">{locale === "zh-CN" ? "暂无平台健康数据" : "No platform health data"}</div>}
            </div>
            <div className="section-head">
              <h2>{locale === "zh-CN" ? "异常与风险" : "Anomalies and risks"}</h2>
            </div>
            <div className="stack compact">
              {platformHealth?.anomalies?.length
                ? platformHealth.anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="log-item">
                      <strong>{anomaly.id}</strong> · {anomaly.count} · {anomaly.severity}
                      <br />
                      <span className="preserve-breaks">{anomaly.description}</span>
                      {anomaly.taskIds.length ? (
                        <>
                          <br />
                          <span className="meta">{anomaly.taskIds.join(", ")}</span>
                        </>
                      ) : null}
                    </div>
                  ))
                : <div className="detail-empty">{locale === "zh-CN" ? "当前没有异常项" : "No anomalies detected"}</div>}
            </div>
          </article>
        </section>
      )}

      {createDialogMode ? (
        <CreateDialog
          locale={locale}
          mode={createDialogMode}
          projects={projects}
          selectedProjectId={selectedProjectId}
          closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
          onClose={() => setCreateDialogMode(null)}
          onCreateProject={onCreateProject}
          onCreateTask={onCreateTask}
        />
      ) : null}
      </div>
  );
}

function CreateDialog({
  locale,
  mode,
  projects,
  selectedProjectId,
  closeLabel,
  onClose,
  onCreateProject,
  onCreateTask,
}: {
  locale: Locale;
  mode: CreateDialogMode;
  projects: Project[];
  selectedProjectId: string;
  closeLabel: string;
  onClose: () => void;
  onCreateProject: (formElement: HTMLFormElement) => Promise<void>;
  onCreateTask: (formElement: HTMLFormElement) => Promise<void>;
}) {
  const title =
    mode === "project"
      ? locale === "zh-CN"
        ? "创建项目"
        : "Create project"
      : mode === "composite_task"
        ? locale === "zh-CN"
          ? "创建模糊/组合任务"
          : "Create composite task"
      : locale === "zh-CN"
        ? "创建任务"
        : "Create task";

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-head">
          <h3>{title}</h3>
          <button type="button" className="icon-button" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </div>

        {mode === "project" ? (
          <form
            className="stack compact"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onCreateProject(event.currentTarget);
            }}
          >
            <input name="name" placeholder={locale === "zh-CN" ? "项目名称" : "Project name"} required />
            <textarea name="description" rows={4} placeholder={locale === "zh-CN" ? "目标 / 范围 / 备注" : "Goal / scope / notes"} />
            <input name="repository" placeholder="GitHub URL (optional)" />
            <select name="visibility" defaultValue="private">
              <option value="private">{locale === "zh-CN" ? "私有仓库" : "Private repo"}</option>
              <option value="public">{locale === "zh-CN" ? "公开仓库" : "Public repo"}</option>
            </select>
            <label className="check-row">
              <input type="checkbox" name="autoCreateRepo" />
              <span>{locale === "zh-CN" ? "自动创建 GitHub 仓库" : "Auto-create GitHub repository"}</span>
            </label>
            <button type="submit" className="primary">{locale === "zh-CN" ? "创建项目" : "Create project"}</button>
          </form>
        ) : (
          <form
            className="stack compact"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onCreateTask(event.currentTarget);
            }}
          >
            {mode === "task" ? (
              <select name="projectId" defaultValue={selectedProjectId || projects[0]?.id}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {getProjectDisplayName(project.id, locale)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="form-note">
                {locale === "zh-CN"
                  ? "该任务从项目层级发起，不预先绑定项目，由 AI 判断应归属到哪个项目，或是否需要拆分到多个项目。"
                  : "This task starts from the project layer without a fixed project. AI will decide the target project or split it across multiple projects."}
              </div>
            )}
            <input type="hidden" name="type" value={mode === "composite_task" ? "composite_task" : "task"} />
            <input name="title" placeholder={locale === "zh-CN" ? "任务标题" : "Task title"} required />
            <textarea name="description" rows={5} placeholder={locale === "zh-CN" ? "希望 Codex 完成什么" : "What should Codex do?"} required />
            <button type="submit" className="primary">{locale === "zh-CN" ? "创建任务" : "Create task"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusFilterBar({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: StatusFilterValue;
  onChange: (next: StatusFilterValue) => void;
}) {
  return (
    <div className="list-filter-bar">
      <label className="list-filter-control">
        <span className="meta">{locale === "zh-CN" ? "当前状态筛选" : "Filter by status"}</span>
        <select value={value} onChange={(event) => onChange(event.target.value as StatusFilterValue)}>
          <option value={STATUS_FILTER_ALL}>{locale === "zh-CN" ? "全部状态" : "All statuses"}</option>
          {(Object.keys(statusLabel) as TaskStatus[]).map((status) => (
            <option key={status} value={status}>
              {statusLabel[status][locale]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TaskDetail({
  requirement,
  task,
  locale,
  onMutate,
  onRespond,
  anomalies,
  dismissedAnomalyIds,
  onDismissAnomaly,
}: {
  requirement: Requirement;
  task: Task;
  locale: Locale;
  onMutate: (taskId: string, action: "stop" | "retry") => Promise<void>;
  onRespond: (taskId: string, decision: "approve" | "reject", feedback: string) => Promise<void>;
  anomalies: WorkspaceAnomaly[];
  dismissedAnomalyIds: Set<string>;
  onDismissAnomaly: (anomaly: WorkspaceAnomaly) => void;
}) {
  const [showRawLogs, setShowRawLogs] = useState(false);
  const logViews = buildLogViews(task.logs);
  const visibleLogs = showRawLogs ? logViews.raw : logViews.important;

  return (
    <div className="detail-card">
      <div className="detail-hero">
        <div>
          <div className="meta">
            {getProjectDisplayName(task.projectId, locale)} · {task.type} · requirement #{requirement.latestAttemptNumber}
          </div>
          <h3 className="wrap-anywhere">{task.title}</h3>
          <div className="meta">
            {locale === "zh-CN" ? "状态：" : "Status: "}
            {statusLabel[task.status][locale]}
          </div>
        </div>
        <div className="action-row detail-actions">
          {task.status === "waiting_user" ? (
            <>
              <button type="button" className="primary" onClick={() => void onRespond(task.id, "approve", "")}>
                {locale === "zh-CN" ? "通过" : "Approve"}
              </button>
              <button type="button" className="ghost" onClick={() => void onRespond(task.id, "reject", "")}>
                {locale === "zh-CN" ? "拒绝" : "Reject"}
              </button>
            </>
          ) : null}
          {task.status === "awaiting_acceptance" ? (
            <>
              <button type="button" className="primary" onClick={() => void onRespond(task.id, "approve", "")}>
                {locale === "zh-CN" ? "验收通过" : "Accept"}
              </button>
              <button type="button" className="ghost" onClick={() => void onRespond(task.id, "reject", "")}>
                {locale === "zh-CN" ? "打回返修" : "Needs revision"}
              </button>
            </>
          ) : null}
          {task.status === "running" ? (
            <button type="button" className="ghost" onClick={() => void onMutate(task.id, "stop")}>
              {locale === "zh-CN" ? "停止" : "Stop"}
            </button>
          ) : null}
          {task.status === "failed" || task.status === "stopped" || task.status === "needs_revision" || task.status === "publish_failed" ? (
            <button type="button" className="ghost" onClick={() => void onMutate(task.id, "retry")}>
              {locale === "zh-CN" ? "重试" : "Retry"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="detail-grid">
        <div className="info-card full-width">
          <div className="info-label">{locale === "zh-CN" ? "描述" : "Description"}</div>
          <div className="wrap-anywhere preserve-breaks">{normalizeDisplayText(task.description) || (locale === "zh-CN" ? "暂无描述" : "No description")}</div>
        </div>

        {task.planPreview ? (
          <div className="info-card full-width">
            <div className="info-label">{locale === "zh-CN" ? "计划预览" : "Plan preview"}</div>
            <div className="wrap-anywhere preserve-breaks">{normalizeDisplayText(task.planPreview)}</div>
          </div>
        ) : null}

        {(task.userSummary || task.summary) ? (
          <div className="info-card full-width">
            <div className="info-label">{locale === "zh-CN" ? "摘要" : "Summary"}</div>
            <div className="wrap-anywhere preserve-breaks">{normalizeDisplayText(task.userSummary || task.summary)}</div>
          </div>
        ) : null}

        {task.openFailureReason ? (
          <div className="info-card full-width">
            <div className="info-label">{locale === "zh-CN" ? "未完成原因" : "Why not completed"}</div>
            <div className="wrap-anywhere preserve-breaks">{normalizeDisplayText(task.openFailureReason)}</div>
          </div>
        ) : null}

        {anomalies.length ? (
          <div className="info-card full-width">
            <div className="info-label">{locale === "zh-CN" ? "当前异常闭环" : "Current anomaly handling"}</div>
            <div className="stack compact">
              {anomalies.map((anomaly) => {
                const isDismissed = dismissedAnomalyIds.has(anomaly.id);
                return (
                  <div key={anomaly.id} className="log-item">
                    <strong>{statusLabel[anomaly.status][locale]}</strong>
                    <br />
                    <span className="preserve-breaks">{normalizeDisplayText(anomaly.detail)}</span>
                    {isDismissed ? null : (
                      <div className="action-row detail-subactions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => onDismissAnomaly(anomaly)}
                        >
                          {locale === "zh-CN" ? "标记已处理" : "Mark handled"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {requirement.acceptanceCriteria?.length ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "验收清单" : "Acceptance checklist"}</div>
            <div className="stack compact">
              {requirement.acceptanceCriteria.map((criterion) => {
                const verification = requirement.verificationResults?.find((item) => item.criterionId === criterion.id);
                return (
                  <div key={criterion.id} className="log-item">
                    <strong>{criterion.text}</strong>
                    <br />
                    {(verification?.status || "pending")} {verification?.evidence ? `· ${verification.evidence}` : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {requirement.attempts.length > 1 ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "尝试历史" : "Attempt history"}</div>
            <div className="stack compact">
              {requirement.attempts.map((attempt) => (
                <div key={attempt.id} className="log-item">
                  <strong>#{attempt.attemptNumber || "?"}</strong> · {statusLabel[attempt.status][locale]}
                  <br />
                  <span className="preserve-breaks">{normalizeDisplayText(attempt.userSummary || attempt.summary || attempt.openFailureReason || attempt.description)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {task.branchName ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "分支" : "Branch"}</div>
            <div className="wrap-anywhere">{task.branchName}</div>
          </div>
        ) : null}

        {task.workspacePath ? (
          <div className="info-card">
            <div className="info-label">{locale === "zh-CN" ? "工作区" : "Workspace"}</div>
            <div className="wrap-anywhere">{task.workspacePath}</div>
          </div>
        ) : null}

        {task.children.length ? (
            <div className="info-card">
              <div className="info-label">{locale === "zh-CN" ? "子任务" : "Child tasks"}</div>
              <div className="wrap-anywhere preserve-breaks">
                {task.children.map((child) => `${child.title} (${statusLabel[child.status][locale]})`).join("\n")}
              </div>
            </div>
          ) : null}
      </div>

      <div className="log-list">
        <div className="section-head">
          <h3>{locale === "zh-CN" ? "任务日志" : "Task logs"}</h3>
          {task.logs.length > logViews.important.length ? (
            <button type="button" className="ghost" onClick={() => setShowRawLogs((current) => !current)}>
              {showRawLogs
                ? locale === "zh-CN"
                  ? "只看关键日志"
                  : "Show important only"
                : locale === "zh-CN"
                  ? "展开原始日志"
                  : "Show raw logs"}
            </button>
          ) : null}
        </div>
        {visibleLogs.length ? (
          visibleLogs.map((entry) => (
            <div key={`${entry.timestamp}-${entry.message}`} className="log-item">
              <div className="meta">{new Date(entry.timestamp).toLocaleString(locale)}</div>
              <div className="wrap-anywhere preserve-breaks">{normalizeDisplayText(entry.message)}</div>
            </div>
          ))
        ) : (
          <div className="detail-empty">{locale === "zh-CN" ? "暂无关键日志" : "No important logs yet"}</div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  locale,
  onRespond,
  onOpenTask,
}: {
  approval: Approval;
  locale: Locale;
  onRespond: (taskId: string, decision: "approve" | "reject", feedback: string) => Promise<void>;
  onOpenTask: (taskId: string) => void;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="approval-item">
      <div className="title wrap-anywhere">{approval.task.title}</div>
      <div className="meta wrap-anywhere">{approval.task.userAction?.title || approval.reason}</div>
      {approval.task.userAction?.detail ? <div className="meta wrap-anywhere">{approval.task.userAction.detail}</div> : null}
      <div className="meta">
        {getProjectDisplayName(approval.task.projectId, locale)} · {approval.task.type}
      </div>
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={locale === "zh-CN" ? "可选：审批反馈或限制条件" : "Optional feedback or constraints"}
      />
      <div className="action-row">
        <button type="button" className="primary" onClick={() => void onRespond(approval.task.id, "approve", feedback)}>
          {locale === "zh-CN" ? "通过" : "Approve"}
        </button>
        <button type="button" className="ghost" onClick={() => void onRespond(approval.task.id, "reject", feedback)}>
          {locale === "zh-CN" ? "拒绝" : "Reject"}
        </button>
        <button type="button" className="ghost" onClick={() => onOpenTask(approval.task.id)}>
          {locale === "zh-CN" ? "打开任务" : "Open task"}
        </button>
      </div>
    </div>
  );
}

function HeaderSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className="switch-card header-switch">
      <span className="switch-copy">
        <span className="mobile-nav-action-label">{label}</span>
      </span>
      <button
        type="button"
        className={checked ? "theme-toggle is-active" : "theme-toggle"}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
      >
        <span className="theme-toggle-handle" aria-hidden="true" />
      </button>
    </div>
  );
}

function HeaderLocaleSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Locale;
  onChange: (next: Locale) => void;
}) {
  return (
    <div className="switch-card header-switch locale-switch-card">
      <span className="switch-copy">
        <span className="mobile-nav-action-label">{label}</span>
      </span>
      <div className="locale-segmented" role="tablist" aria-label={label}>
        {[
          { label: "中文", value: "zh-CN" },
          { label: "English", value: "en-US" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "locale-segment is-active" : "locale-segment"}
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value as Locale)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
