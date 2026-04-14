import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  Divider,
  Drawer,
  Empty,
  Flex,
  Grid,
  Layout,
  List,
  Progress,
  Segmented,
  Space,
  Tag,
  Tabs,
  Typography,
  theme as antdTheme,
} from "antd";
import { MenuOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import {
  ApprovalCard,
  CreateDialog,
  HeaderLocaleSwitch,
  HeaderSwitch,
  ListPagination,
  MetricCard,
  SectionHeader,
  StatusFilterBar,
  TaskDetail,
} from "./dashboardComponents";
import type {
  Approval,
  AuthConfig,
  CopyState,
  CreateDialogMode,
  CreateProjectValues,
  CreateTaskValues,
  DeviceLoginSession,
  DismissedAnomaly,
  IssueTask,
  Locale,
  NoticeItem,
  NoticeTone,
  PlatformHealth,
  Project,
  Requirement,
  RuntimeMode,
  StatusFilterValue,
  Task,
  TaskLog,
  TaskStatus,
  ThemeMode,
  ToolLink,
  UsageLimitWindow,
  UsageOverview,
  WorkspaceAnomaly,
  WorkspaceLevel,
} from "./dashboardTypes";

const DEFAULT_API_BASE = (import.meta.env.VITE_DEFAULT_API_BASE as string | undefined)?.trim() || "http://localhost:8787";
const GITHUB_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() || "";
const GITHUB_TASK_REPO = (import.meta.env.VITE_GITHUB_TASK_REPO as string | undefined)?.trim() || "zhaohernando-code/dashboard-ui";
const GITHUB_STATUS_ISSUE_TITLE = (import.meta.env.VITE_GITHUB_STATUS_ISSUE_TITLE as string | undefined)?.trim() || "Codex Control Plane Status";
const GITHUB_SCOPES = (import.meta.env.VITE_GITHUB_OAUTH_SCOPES as string | undefined)?.trim() || "read:user repo";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const HAS_MIXED_CONTENT_LOCAL_API =
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  /^http:\/\/(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(DEFAULT_API_BASE);
const AUTO_ROUTE_PROJECT_ID = "__auto_route__";
const CLOSED_ANOMALIES_STORAGE_KEY = "codex.dismissedAnomalies";
const STATUS_FILTER_ALL = "all";
const DEFAULT_TASK_MODEL = "gpt-5.4";
const DEFAULT_REASONING_EFFORT = "high";
const REQUIREMENT_PAGE_SIZE_DESKTOP = 8;
const REQUIREMENT_PAGE_SIZE_MOBILE = 6;
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

const statusTagColor: Record<TaskStatus, string> = {
  pending_capture: "blue",
  pending: "orange",
  running: "processing",
  waiting_user: "purple",
  awaiting_acceptance: "gold",
  needs_revision: "volcano",
  publish_failed: "red",
  superseded: "default",
  implemented: "cyan",
  failed: "red",
  completed: "success",
  stopped: "default",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractRepositoryName(repository: string) {
  const trimmed = String(repository || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.git$/i, "") || "";
  } catch {
    return trimmed
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.git$/i, "") || "";
  }
}

function normalizeProjectIdentifier(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function hasNonAscii(value: string) {
  return /[^\x00-\x7F]/.test(String(value || ""));
}

function shouldPreferUnicodeProjectId(name: string, asciiCandidate: string, normalizedCandidate: string) {
  return Boolean(
    String(name || "").trim()
    && asciiCandidate
    && normalizedCandidate
    && asciiCandidate !== normalizedCandidate
    && hasNonAscii(name),
  );
}

function deriveRequestedProjectId(name: string, repository: string, allowGeneratedFallback = true) {
  const normalizedNameId = normalizeProjectIdentifier(name);
  const asciiNameId = slugify(name);
  if (shouldPreferUnicodeProjectId(name, asciiNameId, normalizedNameId)) {
    return normalizedNameId;
  }
  if (asciiNameId) return asciiNameId;
  const asciiRepositoryId = slugify(extractRepositoryName(repository));
  if (asciiRepositoryId) return asciiRepositoryId;
  if (normalizedNameId) return normalizedNameId;
  const normalizedRepositoryId = normalizeProjectIdentifier(extractRepositoryName(repository));
  if (normalizedRepositoryId) return normalizedRepositoryId;
  return allowGeneratedFallback ? `project-${Date.now().toString(36)}` : "";
}

function resolveTaskProjectId(
  type: string,
  rawProjectId: string,
  requestedProject?: { id?: string; name?: string; repository?: string } | null,
  fallbackProjectId = "dashboard-ui",
) {
  if (parseTaskType(type) === "project_create") {
    const explicitProjectId = normalizeProjectIdentifier(String(requestedProject?.id || ""));
    const normalizedNameId = normalizeProjectIdentifier(String(requestedProject?.name || ""));
    const asciiNameId = slugify(String(requestedProject?.name || ""));
    const requestedProjectId =
      (explicitProjectId && shouldPreferUnicodeProjectId(String(requestedProject?.name || ""), asciiNameId, normalizedNameId) && explicitProjectId === asciiNameId
        ? normalizedNameId
        : explicitProjectId)
      || deriveRequestedProjectId(String(requestedProject?.name || ""), String(requestedProject?.repository || ""), false);
    if (requestedProjectId) {
      return requestedProjectId;
    }
  }
  return normalizeProjectIdentifier(rawProjectId) || fallbackProjectId;
}


function parseTaskType(value: string) {
  const raw = String(value || "task").trim().toLowerCase();
  if (raw === "project_create" || raw === "composite_task" || raw === "task") {
    return raw;
  }
  return "task";
}

function requiresPlan(type: string) {
  const normalized = parseTaskType(type);
  return normalized === "project_create" || normalized === "composite_task";
}

function isHighRiskRequest(type: string, title: string, description: string) {
  if (parseTaskType(type) !== "task") {
    return false;
  }
  return /(delete|destroy|drop table|rm -rf|reset --hard|force push|rotate secret|publish|deploy prod|production)/i.test(
    `${title}\n${description}`,
  );
}

function getApprovalReason(type: string, risky: boolean) {
  if (parseTaskType(type) === "project_create") {
    return "Plan confirmation required before creating a new project.";
  }
  if (parseTaskType(type) === "composite_task") {
    return "Plan confirmation required before decomposing a composite task.";
  }
  if (risky) {
    return "Potentially high-risk request detected; explicit approval required.";
  }
  return "Approval required.";
}

function deriveCompositeSteps(description: string) {
  const bullets = String(description || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
  if (bullets.length >= 2) {
    return bullets.slice(0, 5);
  }
  const sentences = String(description || "")
    .split(/[.。!?！？]/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (sentences.length >= 2) {
    return sentences.slice(0, 5);
  }
  return [
    "Clarify and inspect the relevant project context.",
    "Implement the primary requested changes.",
    "Verify behavior and summarize follow-up actions.",
  ];
}

function isGenericProjectDescriptionLine(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/[：:。.!！?？]/g, "");
  if (!normalized) {
    return true;
  }
  return /^(希望有如下功能|希望具备如下功能|功能需求|需求如下|需求|项目需求|包括以下|包括如下|以上为|以上是|以上内容)/.test(normalized);
}

function extractProjectScopeItems(description: string) {
  return String(description || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)、]?|[a-zA-Z][.)])\s*/, "").trim())
    .filter((line) => line && !isGenericProjectDescriptionLine(line))
    .slice(0, 6);
}

function summarizeProjectIntent(description: string) {
  const scopeItems = extractProjectScopeItems(description);
  if (scopeItems.length) {
    return scopeItems[0];
  }
  return (
    String(description || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => line && !isGenericProjectDescriptionLine(line))
    || "New Codex-managed project request."
  );
}

function buildGithubDirectPlanPreview(input: {
  type: string;
  title: string;
  description: string;
  requestedProject?: { name?: string; description?: string } | null;
}) {
  if (parseTaskType(input.type) === "project_create" && input.requestedProject) {
    const projectDescription = input.requestedProject.description || input.description || "";
    const scopeItems = extractProjectScopeItems(projectDescription);
    const scopeSummary = scopeItems.slice(0, 3).join(" / ");
    return [
      `Project: ${input.requestedProject.name || "Untitled project"}`,
      `Intent: ${summarizeProjectIntent(projectDescription)}`,
      ...(scopeItems.length
        ? [
            "Requested scope:",
            ...scopeItems.map((item) => `- ${item}`),
          ]
        : []),
      "Proposed plan:",
      "1. Clarify scope, target users, constraints, and success criteria.",
      "2. Research reusable open-source baselines, data sources, and critical dependencies.",
      scopeSummary
        ? `3. Turn the requested scope into delivery milestones, starting with ${scopeSummary}.`
        : "3. Turn the requested scope into delivery milestones and execution order.",
      "4. After approval, scaffold the repository/workspace, write project rules/process docs, and start the first milestone.",
    ].join("\n");
  }

  if (parseTaskType(input.type) === "composite_task") {
    return [
      `Composite task: ${input.title || "Untitled"}`,
      "Proposed child tasks:",
      ...deriveCompositeSteps(input.description).map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");
  }

  return "";
}

function buildGithubDirectUserAction(input: {
  status: TaskStatus;
  type: string;
  title: string;
  description: string;
  planPreview: string;
  userAction?: Task["userAction"];
}) {
  if (input.status !== "waiting_user") {
    return null;
  }
  if (input.userAction) {
    return input.userAction;
  }
  const risky = isHighRiskRequest(input.type, input.title, input.description);
  return {
    type: risky ? "high_risk_approval" : requiresPlan(input.type) ? "plan_approval" : "approval_required",
    title: getApprovalReason(input.type, risky),
    detail: input.planPreview || input.description || input.title,
    risk: risky ? "high" : "medium",
  } satisfies NonNullable<Task["userAction"]>;
}

function parseIssueBody(body: string) {
  const embedded = body.match(/<!--\s*codex-task-payload\s*([\s\S]*?)\s*-->/i);
  if (embedded) {
    try {
      const payload = JSON.parse(embedded[1]);
      const type = parseTaskType(payload.type);
      const requestedProject = payload.requestedProject || null;
      return {
        projectId: resolveTaskProjectId(type, String(payload.projectId || ""), requestedProject),
        type,
        title: String(payload.title || "Untitled task").trim(),
        description: String(payload.description || "").trim(),
        model: normalizeRequestedModel(String(payload.model || "")),
        reasoningEffort: normalizeRequestedReasoningEffort(String(payload.reasoningEffort || payload.reasoningLevel || "")),
        requestedProject,
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
  const type = parseTaskType(meta.type || "task");
  return {
    projectId: resolveTaskProjectId(type, meta.project || meta.projectid || "", null),
    type,
    title: "",
    description: String(body || "").replace(/<!--[\s\S]*?-->/g, "").trim(),
    model: normalizeRequestedModel(meta.model || ""),
    reasoningEffort: normalizeRequestedReasoningEffort(meta.reasoning || meta.reasoninglevel || meta.reasoning_effort || ""),
    requestedProject: null,
  };
}

function parseEmbeddedStatusPayload(body: string) {
  const match = String(body || "").match(/<!--\s*codex-status-snapshot\s*([\s\S]*?)\s*-->/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
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
      userAction?: Task["userAction"];
      openFailureReason?: string;
      publishStatus?: string;
    };
  } catch {
    return null;
  }
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

function normalizeRequestedModel(value: string): string {
  return String(value || "").trim() || DEFAULT_TASK_MODEL;
}

function normalizeRequestedReasoningEffort(value: string): NonNullable<Task["reasoningEffort"]> {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "normal") {
    return "medium";
  }
  if (raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw;
  }
  return DEFAULT_REASONING_EFFORT;
}

function parseStatusFromComments(comments: IssueComment[], fallbackClosed: boolean): {
  status: TaskStatus;
  taskId: string;
  summary: string;
  userSummary: string;
  planPreview: string;
  userAction: Task["userAction"];
  openFailureReason: string;
  publishStatus: string;
} {
  let status: TaskStatus = fallbackClosed ? "completed" : "pending";
  let taskId = "";
  let summary = "";
  let userSummary = "";
  let planPreview = "";
  let userAction: Task["userAction"] = null;
  let openFailureReason = "";
  let publishStatus = "";

  for (const comment of comments) {
    const rawBody = String(comment.body || "");
    const body = normalizeCommentLogMessage(rawBody);
    const embedded = parseEmbeddedTaskStatusPayload(rawBody);
    if (embedded?.taskId) {
      taskId = String(embedded.taskId).trim() || taskId;
    }
    if (embedded?.status && Object.prototype.hasOwnProperty.call(statusLabel, embedded.status)) {
      status = embedded.status;
    }
    if (typeof embedded?.summary === "string" && embedded.summary.trim()) {
      summary = embedded.summary.trim();
    }
    if (typeof embedded?.userSummary === "string" && embedded.userSummary.trim()) {
      userSummary = embedded.userSummary.trim();
    }
    if (typeof embedded?.planPreview === "string" && embedded.planPreview.trim()) {
      planPreview = embedded.planPreview.trim();
    }
    if (embedded?.userAction && typeof embedded.userAction === "object") {
      userAction = embedded.userAction;
    }
    if (typeof embedded?.openFailureReason === "string" && embedded.openFailureReason.trim()) {
      openFailureReason = embedded.openFailureReason.trim();
    }
    if (typeof embedded?.publishStatus === "string" && embedded.publishStatus.trim()) {
      publishStatus = embedded.publishStatus.trim();
    }

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
      const publishMatch = body.match(/Publish:\s*`?([^`\n]+)`?/i);
      if (publishMatch) {
        publishStatus = publishMatch[1].trim();
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
    userAction,
    openFailureReason,
    publishStatus,
  };
}

function buildLogsFromComments(comments: IssueComment[]) {
  return comments
    .map((comment, index) => {
      const message = normalizeCommentLogMessage(comment.body);
      if (!message) return null;

      const command = parseCommentCommand(message);
      if (["/approve", "/reject", "/feedback", "/retry", "/stop"].includes(command)) {
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

function getTaskProjectDisplayName(task: Pick<Task, "projectId" | "projectName" | "type" | "requestedProject">) {
  if (task.projectId === AUTO_ROUTE_PROJECT_ID) {
    return "AI-routed";
  }
  const requestedName = String(task.requestedProject?.name || "").trim();
  return requestedName || String(task.projectName || "").trim() || task.projectId;
}

function getTaskProjectDescription(task: Pick<Task, "projectId" | "description" | "requestedProject">) {
  if (task.projectId === AUTO_ROUTE_PROJECT_ID) {
    return "Composite or cross-project work waiting for AI routing.";
  }
  return String(task.requestedProject?.description || "").trim() || "";
}

function getTaskProjectRepository(task: Pick<Task, "requestedProject">) {
  return String(task.requestedProject?.repository || "").trim();
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
        name: getTaskProjectDisplayName(task),
        description: getTaskProjectDescription(task),
        repository: getTaskProjectRepository(task),
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
        name: getTaskProjectDisplayName(task),
        description: getTaskProjectDescription(task),
        repository: getTaskProjectRepository(task),
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

function getProjectDisplayName(projectId: string, locale: Locale, displayName?: string) {
  if (projectId === AUTO_ROUTE_PROJECT_ID) {
    return locale === "zh-CN" ? "AI 待判定项目" : "AI-routed";
  }
  return String(displayName || "").trim() || projectId;
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

function normalizePlatformHealth(raw: unknown): PlatformHealth | null {
  const record = asRecord(raw);
  if (!record) return null;

  const issuePoller = asRecord(record.issuePoller) || {};
  const githubApi = asRecord(record.githubApi) || {};
  const publishing = asRecord(record.publishing) || {};
  const taskState = asRecord(record.taskState) || {};
  const anomalies = Array.isArray(record.anomalies) ? record.anomalies : [];

  return {
    generatedAt: String(record.generatedAt || ""),
    taskBackend: String(record.taskBackend || ""),
    githubTaskRepo: String(record.githubTaskRepo || ""),
    issuePoller: {
      enabled: Boolean(issuePoller.enabled),
      status: String(issuePoller.status || ""),
      intervalMs: toFiniteNumber(issuePoller.intervalMs) ?? 0,
      inFlight: Boolean(issuePoller.inFlight),
      lastStartedAt: String(issuePoller.lastStartedAt || ""),
      lastSuccessAt: String(issuePoller.lastSuccessAt || ""),
      lastDurationMs: toFiniteNumber(issuePoller.lastDurationMs) ?? 0,
      lastError: String(issuePoller.lastError || ""),
    },
    githubApi: {
      inFlight: toFiniteNumber(githubApi.inFlight) ?? 0,
      queued: toFiniteNumber(githubApi.queued) ?? 0,
      lastRequestAt: String(githubApi.lastRequestAt || ""),
      lastError: String(githubApi.lastError || ""),
      lastRateLimitAt: String(githubApi.lastRateLimitAt || ""),
      lastRetryAt: String(githubApi.lastRetryAt || ""),
      remaining: githubApi.remaining == null ? null : String(githubApi.remaining),
      resetAt: String(githubApi.resetAt || ""),
    },
    publishing: {
      lastPublishedAt: String(publishing.lastPublishedAt || ""),
      lastPublishedTaskId: String(publishing.lastPublishedTaskId || ""),
      lastPublishedTaskTitle: String(publishing.lastPublishedTaskTitle || ""),
      lastPublishMethod: String(publishing.lastPublishMethod || ""),
      lastPublishError: String(publishing.lastPublishError || ""),
      publishedTasks: toFiniteNumber(publishing.publishedTasks) ?? 0,
      noopTasks: toFiniteNumber(publishing.noopTasks) ?? 0,
      publishFailedTasks: toFiniteNumber(publishing.publishFailedTasks) ?? 0,
      completedWithoutVerifiedPublish: toFiniteNumber(publishing.completedWithoutVerifiedPublish) ?? 0,
    },
    taskState: {
      total: toFiniteNumber(taskState.total) ?? 0,
      running: toFiniteNumber(taskState.running) ?? 0,
      waitingUser: toFiniteNumber(taskState.waitingUser) ?? 0,
      awaitingAcceptance: toFiniteNumber(taskState.awaitingAcceptance) ?? 0,
      needsRevision: toFiniteNumber(taskState.needsRevision) ?? 0,
      publishFailed: toFiniteNumber(taskState.publishFailed) ?? 0,
      stoppedLatest: toFiniteNumber(taskState.stoppedLatest) ?? 0,
    },
    anomalies: anomalies.map((item, index) => {
      const anomaly = asRecord(item) || {};
      return {
        id: String(anomaly.id || `anomaly-${index}`),
        severity: String(anomaly.severity || "info"),
        count: toFiniteNumber(anomaly.count) ?? 0,
        description: String(anomaly.description || ""),
        taskIds: Array.isArray(anomaly.taskIds)
          ? anomaly.taskIds.map((taskId) => String(taskId)).filter(Boolean)
          : [],
      };
    }),
  };
}

function buildGithubDirectUsageFallback(taskList: Task[], locale: Locale): UsageOverview {
  const lastUpdatedTask = [...taskList]
    .filter((task) => task.updatedAt)
    .sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""))[0];

  return {
    totalTasks: taskList.length,
    activeTasks: taskList.filter((task) => task.status === "running").length,
    pendingApprovals: taskList.filter((task) => task.status === "waiting_user").length,
    completedTasks: taskList.filter((task) => task.status === "completed").length,
    failedTasks: taskList.filter((task) => task.status === "failed" || task.status === "publish_failed").length,
    estimatedTokens: 0,
    totalRuns: taskList.length,
    lastRunAt: lastUpdatedTask?.updatedAt || "",
    memberUsageReason:
      locale === "zh-CN"
        ? "当前仅展示 GitHub Issue 任务统计；CLI 用量快照需要可访问的后端 API。"
        : "Showing GitHub issue activity only; CLI quota snapshots still require a reachable backend API.",
    rateLimits: {
      primary: null,
      secondary: null,
    },
    statusCollectedAt: "",
    statusSource: "github-direct-fallback",
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
  const planPreview = normalizeDisplayText(latestAttempt?.status === "waiting_user" ? latestAttempt?.planPreview || "" : "");
  if (planPreview) return planPreview;

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
  const [tools, setTools] = useState<ToolLink[]>([]);
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
  const [requirementPage, setRequirementPage] = useState(1);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const requirementPageSize = isMobile ? REQUIREMENT_PAGE_SIZE_MOBILE : REQUIREMENT_PAGE_SIZE_DESKTOP;
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

  const paginatedSelectedProjectRequirements = useMemo(() => {
    const startIndex = (requirementPage - 1) * requirementPageSize;
    return filteredSelectedProjectRequirements.slice(startIndex, startIndex + requirementPageSize);
  }, [filteredSelectedProjectRequirements, requirementPage, requirementPageSize]);

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

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSelectedProjectRequirements.length / requirementPageSize));
    if (requirementPage > totalPages) {
      setRequirementPage(totalPages);
    }
  }, [filteredSelectedProjectRequirements.length, requirementPage, requirementPageSize]);

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

  async function githubApiRequest<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message || `GitHub API failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!githubToken) {
      throw new Error(locale === "zh-CN" ? "请先使用 GitHub 登录" : "Sign in with GitHub first");
    }
    return githubApiRequest<T>(path, init, githubToken);
  }

  async function loadGithubStatusSnapshot() {
    const [owner, repo] = GITHUB_TASK_REPO.split("/");
    const issues = await githubApiRequest<Array<{
      number: number;
      title: string;
      body: string;
      state: string;
      updated_at: string;
      pull_request?: unknown;
    }>>(`/repos/${owner}/${repo}/issues?state=open&per_page=30&sort=updated&direction=desc`, undefined, githubToken || undefined);
    const issue = issues.find(
      (item) => !item.pull_request && (item.title?.trim() === GITHUB_STATUS_ISSUE_TITLE || /<!--\s*codex-status-snapshot\s*[\s\S]*?-->/i.test(item.body || "")),
    );
    if (!issue) {
      return null;
    }
    return parseEmbeddedStatusPayload(issue.body || "");
  }

  function applyUsageOverview(raw: unknown) {
    const normalized = normalizeUsageOverview(raw);
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
      setPlatformHealth(normalizePlatformHealth(platform.health));
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
                const title = parsed.title || issue.title;
                const description = parsed.description || issue.body || "";
                const planPreview =
                  statusMeta.planPreview ||
                  buildGithubDirectPlanPreview({
                    type: parsed.type,
                    title,
                    description,
                    requestedProject: parsed.requestedProject,
                  });
                const userAction = buildGithubDirectUserAction({
                  status: statusMeta.status,
                  type: parsed.type,
                  title,
                  description,
                  planPreview,
                  userAction: statusMeta.userAction,
                });
                return {
                  id: statusMeta.taskId || `issue-${issue.number}`,
                  updatedAt: issue.updated_at,
                  issueNumber: issue.number,
                  issueUrl: issue.html_url,
                  projectId,
                  projectName: getProjectDisplayName(projectId, locale, parsed.requestedProject?.name || ""),
                  requestedProject: parsed.requestedProject,
                  type: parsed.type,
                  title,
                  description,
                  model: parsed.model,
                  reasoningEffort: parsed.reasoningEffort,
                  status: statusMeta.status,
                  summary: statusMeta.summary,
                  userSummary: statusMeta.userSummary,
                  userAction,
                  planPreview,
                  publishStatus: statusMeta.publishStatus || undefined,
                  openFailureReason: statusMeta.openFailureReason || undefined,
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
              reason:
                task.userAction?.title ||
                (locale === "zh-CN" ? "请在 GitHub Pages 审批后继续执行" : "Approve in GitHub Pages to continue execution"),
              task,
            })),
        );
        setUsage((current) => {
          const hasRuntimeSnapshot = Boolean(
            current?.rateLimits?.primary ||
            current?.rateLimits?.secondary ||
            current?.statusCollectedAt,
          );
          return hasRuntimeSnapshot ? current : buildGithubDirectUsageFallback(taskList, locale);
        });

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
          name: getProjectDisplayName(project.id, locale, project.name),
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
      try {
        const snapshot = await loadGithubStatusSnapshot();
        if (snapshot?.usage) {
          applyUsageOverview(snapshot.usage);
          if (snapshot.health) {
            setPlatformHealth(normalizePlatformHealth(snapshot.health));
          }
          return;
        }
      } catch (error) {
        if (!HAS_MIXED_CONTENT_LOCAL_API) {
          setUsage(buildGithubDirectUsageFallback(tasks, locale));
          setUsageSummary(
            locale === "zh-CN"
              ? `无法从 GitHub 状态快照读取本机用量，已回退到任务统计：${summarizeError(error)}`
              : `Unable to read the GitHub-backed control-plane snapshot. Falling back to task activity: ${summarizeError(error)}`,
          );
          return;
        }
      }

      if (HAS_MIXED_CONTENT_LOCAL_API) {
        setUsage(buildGithubDirectUsageFallback(tasks, locale));
        setUsageSummary(
          locale === "zh-CN"
            ? `当前页面通过 HTTPS 打开，但后端地址是 ${DEFAULT_API_BASE}。浏览器会拦截 GitHub Pages 到本机 HTTP API 的请求；页面现在会优先读取 GitHub 状态快照，如果该快照还未同步出来，则只能先显示任务统计。`
            : `This page is served over HTTPS, but the backend is configured as ${DEFAULT_API_BASE}. Browsers block GitHub Pages from calling a local HTTP API; the dashboard now prefers a GitHub-backed status snapshot, and falls back to task activity until that snapshot is available.`,
        );
        return;
      }
    }
    try {
      const payload = await api<{ overview: UsageOverview }>("/api/usage");
      applyUsageOverview(payload.overview);
    } catch (error) {
      if (runtimeMode === "github-direct") {
        setUsage(buildGithubDirectUsageFallback(tasks, locale));
      } else {
        setUsage(null);
      }
      setUsageSummary(
        runtimeMode === "github-direct"
          ? locale === "zh-CN"
            ? `无法读取本机用量快照，已回退到 GitHub Issue 任务统计：${summarizeError(error)}`
            : `Unable to read the local usage snapshot. Falling back to GitHub issue activity: ${summarizeError(error)}`
          : locale === "zh-CN"
            ? `无法获取用量概览：${summarizeError(error)}`
            : `Unable to load usage overview: ${summarizeError(error)}`,
      );
    }
  }

  async function onCreateProject(values: CreateProjectValues) {
    try {
      const name = String(values.name || "").trim();
      const description = String(values.description || "").trim();
      const repository = String(values.repository || "").trim();
      const visibility = String(values.visibility || "private");
      const autoCreateRepo = Boolean(values.autoCreateRepo);
      const model = normalizeRequestedModel(String(values.model || ""));
      const reasoningEffort = normalizeRequestedReasoningEffort(String(values.reasoningEffort || ""));
      const requestedProjectId = deriveRequestedProjectId(name, repository);
      const requestedProject = {
        id: requestedProjectId,
        name,
        description,
        repository,
        visibility,
        autoCreateRepo,
      };

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = {
          projectId: requestedProjectId,
          type: "project_create",
          title: `Create project: ${name}`,
          description: description || `Create a new Codex-managed project named ${name}.`,
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
            title: `Create project: ${name}`,
            description: description || `Create a new Codex-managed project named ${name}.`,
            model,
            reasoningEffort,
            requestedProject,
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
            model,
            reasoningEffort,
          }),
        });
        setTransientNotice(locale === "zh-CN" ? "项目已创建" : "Project created", "success");
      }
      setSelectedProjectId(requestedProjectId);
      setCreateDialogMode(null);
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
      let createdTask: Task | null = null;

      if (runtimeMode === "github-direct") {
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const payload = { projectId, type, title, description, model, reasoningEffort };
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
          model,
          reasoningEffort,
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
            model,
            reasoningEffort,
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
          model,
          reasoningEffort,
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
            model,
            reasoningEffort,
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

  async function respondToTask(taskId: string, decision: "approve" | "reject" | "feedback", feedback: string) {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (runtimeMode === "github-direct") {
        if (!task?.issueNumber) {
          throw new Error(locale === "zh-CN" ? "当前任务没有对应的 Issue 编号" : "This task is missing an issue number");
        }
        const [owner, repoName] = GITHUB_TASK_REPO.split("/");
        const command = decision === "feedback"
          ? `/feedback ${feedback}`.trim()
          : decision === "approve"
            ? "/approve"
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
      setTransientNotice(
        decision === "feedback"
          ? (locale === "zh-CN" ? "反馈已提交，正在更新计划" : "Feedback submitted. Updating plan.")
          : locale === "zh-CN"
            ? "审批结果已提交"
            : "Decision submitted",
        "success",
      );
      await refreshAll();
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedRequirementId("");
    setRequirementPage(1);
    setWorkspaceLevel("tasks");
  }

  function openRequirement(requirement: Requirement) {
    const requirementIndex = visibleRequirements
      .filter(
        (candidate) => candidate.projectId === requirement.projectId && matchesStatusFilter(candidate.status, requirementStatusFilter),
      )
      .findIndex((candidate) => candidate.id === requirement.id);

    if (requirementIndex >= 0) {
      setRequirementPage(Math.floor(requirementIndex / requirementPageSize) + 1);
    }
    setSelectedProjectId(requirement.projectId);
    setSelectedRequirementId(requirement.id);
    setSelectedTaskId(requirement.latestAttemptId);
    setWorkspaceLevel("detail");
  }

  function handleRequirementStatusFilterChange(next: StatusFilterValue) {
    setRequirementStatusFilter(next);
    setRequirementPage(1);
  }

  const breadcrumbs = [
    { key: "projects", label: locale === "zh-CN" ? "项目" : "Projects", active: workspaceLevel === "projects", onClick: () => setWorkspaceLevel("projects") },
    ...(selectedProject
      ? [
          {
            key: "tasks",
            label: getProjectDisplayName(selectedProject.id, locale, selectedProject.name),
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
          ? `${getProjectDisplayName(selectedProject?.id || "", locale, selectedProject?.name) || "当前项目"} 下的需求线程`
          : `Requirement threads under ${getProjectDisplayName(selectedProject?.id || "", locale, selectedProject?.name) || "the current project"}`
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
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#1f66ff",
          borderRadius: 18,
          fontFamily: '"IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif',
          fontFamilyCode: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
        },
      }}
    >
      <AntApp>
        <Layout className="app-shell">
          <div className="app-root">
            <Card className="topbar-card" bordered={false}>
              <Flex justify="space-between" align="center" gap={16} wrap>
                <Flex align="center" gap={14} className="brand-wrap">
                  <div className="brand-mark" aria-hidden="true">
                    C
                  </div>
                  <div className="brand-copy">
                    <Typography.Title level={3} className="brand-title">
                      {t.title}
                    </Typography.Title>
                    <Typography.Text type="secondary" className="brand-subtitle">
                      {t.subtitle}
                    </Typography.Text>
                  </div>
                </Flex>
                <Space size={12} wrap className="topbar-actions">
                  <Tag color="blue">{runtimeMode === "github-direct" ? "GitHub Direct" : "Local API"}</Tag>
                  <Typography.Text type="secondary" className="api-base-label">
                    {t.localApi} {runtimeMode === "github-direct" ? GITHUB_TASK_REPO : DEFAULT_API_BASE}
                  </Typography.Text>
                  {!isMobile ? (
                    <>
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
                      {authConfig?.user ? (
                        <Button onClick={() => void logout()}>{t.logoutButton}</Button>
                      ) : (
                        <Button
                          type="primary"
                          onClick={() => void loginWithGithub()}
                          disabled={runtimeMode !== "github-direct" && !authConfig?.enabled}
                        >
                          {t.loginButton}
                        </Button>
                      )}
                    </>
                  ) : null}
                </Space>
              </Flex>
            </Card>

            {deviceLogin ? (
              <Card className="section-card" bordered={false}>
                <SectionHeader
                  title={locale === "zh-CN" ? "GitHub 设备登录" : "GitHub Device Login"}
                  subtitle={
                    locale === "zh-CN"
                      ? "打开链接并输入验证码，页面会在当前会话中自动轮询。"
                      : "Open the link and enter the code. Polling stays inside this session."
                  }
                  actions={
                    <Button onClick={cancelDeviceLogin}>
                      {locale === "zh-CN" ? "关闭" : "Close"}
                    </Button>
                  }
                />
                <Space direction="vertical" size={16} className="block-stack full-width">
                  <Space wrap>
                    <a href={deviceLogin.verificationUri} target="_blank" rel="noreferrer">
                      {deviceLogin.verificationUri}
                    </a>
                    <Button type="primary" onClick={() => void copyDeviceCode()}>
                      {copyState === "copied" ? (locale === "zh-CN" ? "已复制" : "Copied") : locale === "zh-CN" ? "复制验证码" : "Copy code"}
                    </Button>
                  </Space>
                  <Typography.Text code className="device-code">
                    {deviceLogin.userCode}
                  </Typography.Text>
                  <Alert type="info" message={deviceLogin.status} showIcon />
                  {deviceLogin.error ? <Alert type="error" message={deviceLogin.error} showIcon /> : null}
                </Space>
              </Card>
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

            {!isMobile ? (
              <div className="tabs-strip">
                <Tabs
                  activeKey={activeTab}
                  onChange={(value) => setActiveTab(value as (typeof tabs)[number]["id"])}
                  items={tabs.map((tab) => ({
                    key: tab.id,
                    label: tab.label[locale],
                  }))}
                  className="desktop-tabs"
                />
              </div>
            ) : (
              <Button
                type="primary"
                icon={<MenuOutlined />}
                className="mobile-nav-trigger"
                onClick={() => setIsMobileNavOpen(true)}
              >
                {t.mobileControlTitle}
              </Button>
            )}

            <Drawer
              title={t.mobileControlTitle}
              placement="bottom"
              height="auto"
              open={isMobileNavOpen}
              onClose={() => setIsMobileNavOpen(false)}
              className="mobile-drawer"
            >
              <Space direction="vertical" size={16} className="full-width">
                <Button block onClick={() => setIsMobileViewDrawerOpen(true)}>
                  {t.openViewDrawer}
                </Button>
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
                {authConfig?.user ? (
                  <Button block onClick={() => void logout()}>
                    {t.logoutButton}
                  </Button>
                ) : (
                  <Button
                    block
                    type="primary"
                    onClick={() => void loginWithGithub()}
                    disabled={runtimeMode !== "github-direct" && !authConfig?.enabled}
                  >
                    {t.loginButton}
                  </Button>
                )}
              </Space>
            </Drawer>

            <Drawer
              title={t.mobileViewDrawerTitle}
              placement="bottom"
              height="auto"
              open={isMobileViewDrawerOpen}
              onClose={() => setIsMobileViewDrawerOpen(false)}
              className="mobile-drawer"
            >
              <Segmented
                block
                options={tabs.map((tab) => ({ label: tab.label[locale], value: tab.id }))}
                value={activeTab}
                onChange={(value) => {
                  setActiveTab(value as (typeof tabs)[number]["id"]);
                  setIsMobileViewDrawerOpen(false);
                }}
              />
            </Drawer>

            {activeTab === "quest-center" ? (
              <div className={isMobile ? "workspace-layout" : "workspace-layout view-pane"}>
                <Card className="pane-card workspace-main-card" bordered={false}>
                  <Flex justify="space-between" gap={16} wrap className="workspace-toolbar">
                    <div className="breadcrumb-row" aria-label="Breadcrumb">
                      {breadcrumbs.map((crumb) => (
                        <Button
                          key={crumb.key}
                          type={crumb.active ? "primary" : "default"}
                          onClick={crumb.onClick}
                          className="breadcrumb-button"
                        >
                          {crumb.label}
                        </Button>
                      ))}
                    </div>
                    <Space wrap>
                      <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
                        {t.refresh}
                      </Button>
                      {workspaceLevel === "projects" ? (
                        <Button onClick={() => setCreateDialogMode("composite_task")}>
                          {locale === "zh-CN" ? "模糊/组合任务" : "Composite task"}
                        </Button>
                      ) : null}
                      {createLabel ? (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setCreateDialogMode(workspaceLevel === "projects" ? "project" : "task")}
                        >
                          {createLabel}
                        </Button>
                      ) : null}
                    </Space>
                  </Flex>

                  <SectionHeader
                    title={workspaceTitle}
                    subtitle={workspaceDescription}
                    actions={
                      workspaceLevel === "projects" ? (
                        <StatusFilterBar
                          locale={locale}
                          value={projectStatusFilter}
                          onChange={setProjectStatusFilter}
                          statusFilterAll={STATUS_FILTER_ALL}
                          statusLabel={statusLabel}
                        />
                      ) : workspaceLevel === "tasks" ? (
                        <StatusFilterBar
                          locale={locale}
                          value={requirementStatusFilter}
                          onChange={handleRequirementStatusFilterChange}
                          statusFilterAll={STATUS_FILTER_ALL}
                          statusLabel={statusLabel}
                        />
                      ) : undefined
                    }
                  />

                  {workspaceLevel === "projects" ? (
                    filteredProjects.length ? (
                      <div className="entity-grid">
                        {filteredProjects.map((project) => (
                          <Card
                            key={project.id}
                            hoverable
                            className="entity-card"
                            onClick={() => openProject(project.id)}
                          >
                            <Flex justify="space-between" align="flex-start" gap={12}>
                              <Space direction="vertical" size={6} className="full-width">
                                <Typography.Title level={5} className="card-title">
                                  {getProjectDisplayName(project.id, locale, project.name)}
                                </Typography.Title>
                                <Typography.Text type="secondary">
                                  {(project.id === AUTO_ROUTE_PROJECT_ID
                                    ? locale === "zh-CN"
                                      ? "模糊或跨项目任务暂存区，等待 AI 判断路由。"
                                      : "Staging area for composite or cross-project tasks before AI routing."
                                    : project.description) || (locale === "zh-CN" ? "暂无项目描述" : "No description")}
                                </Typography.Text>
                              </Space>
                              <Tag color="blue">
                                {project.taskStats.running}/{project.taskStats.total}
                              </Tag>
                            </Flex>
                            <Divider />
                            <Typography.Text type="secondary" className="wrap-anywhere">
                              {project.repository || (locale === "zh-CN" ? "未绑定仓库" : "No repository")}
                            </Typography.Text>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Empty description={locale === "zh-CN" ? "当前筛选下暂无项目" : "No projects match this status filter"} />
                    )
                  ) : null}

                  {workspaceLevel === "tasks" ? (
                    filteredSelectedProjectRequirements.length ? (
                      <div className="section-stack">
                        <div className="entity-grid">
                          {paginatedSelectedProjectRequirements.map((requirement) => (
                            <Card
                              key={requirement.id}
                              hoverable
                              className="entity-card"
                              onClick={() => openRequirement(requirement)}
                            >
                              <Space direction="vertical" size={10} className="full-width">
                                <Flex justify="space-between" align="flex-start" gap={12}>
                                  <Typography.Title level={5} className="card-title clamp-2">
                                    {requirement.title}
                                  </Typography.Title>
                                  <Tag color={statusTagColor[requirement.status]}>{statusLabel[requirement.status][locale]}</Tag>
                                </Flex>
                                <Typography.Text type="secondary">
                                  {getProjectDisplayName(requirement.projectId, locale, requirement.projectName)} · attempt #{requirement.latestAttemptNumber}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {locale === "zh-CN" ? "验收：" : "Acceptance: "}
                                  {requirement.acceptanceCompleted}/{requirement.acceptanceTotal}
                                  {requirement.publishStatus ? ` · ${requirement.publishStatus}` : ""}
                                </Typography.Text>
                                <Typography.Paragraph className="entity-preview" ellipsis={{ rows: 3 }}>
                                  {getRequirementPreview(requirement, locale)}
                                </Typography.Paragraph>
                              </Space>
                            </Card>
                          ))}
                        </div>
                        <ListPagination
                          locale={locale}
                          current={requirementPage}
                          pageSize={requirementPageSize}
                          total={filteredSelectedProjectRequirements.length}
                          itemLabel={{ "zh-CN": "需求", "en-US": "requirements" }}
                          onChange={setRequirementPage}
                        />
                      </div>
                    ) : (
                      <Empty description={locale === "zh-CN" ? "当前筛选下暂无需求" : "No requirements match this status filter"} />
                    )
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
                        statusLabel={statusLabel}
                        statusTagColor={statusTagColor}
                        getProjectDisplayName={getProjectDisplayName}
                        normalizeDisplayText={normalizeDisplayText}
                        buildLogViews={buildLogViews}
                      />
                    ) : (
                      <Empty description={t.noTask} />
                    )
                  ) : null}
                </Card>

                <div className="workspace-side">
                  <Card className="pane-card" bordered={false}>
                    <SectionHeader
                      title={t.pendingApprovals}
                      actions={
                        <Button icon={<ReloadOutlined />} onClick={() => void refreshApprovals()}>
                          {t.refresh}
                        </Button>
                      }
                    />
                    <div className="section-stack">
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
                            statusLabel={statusLabel}
                            statusTagColor={statusTagColor}
                            getProjectDisplayName={getProjectDisplayName}
                          />
                        ))
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "当前没有待审批" : "No pending approvals"} />
                      )}
                    </div>
                    <Divider />
                    <SectionHeader title={locale === "zh-CN" ? "异常队列" : "Anomaly queue"} />
                    <div className="section-stack">
                      {visibleWorkspaceAnomalies.length ? (
                        visibleWorkspaceAnomalies.map((item) => (
                          <Card key={item.id} size="small" className="list-card">
                            <Space direction="vertical" size={10} className="full-width">
                              <Flex justify="space-between" align="flex-start" gap={12}>
                                <Typography.Text strong>{item.title}</Typography.Text>
                                <Tag color={statusTagColor[item.status]}>{statusLabel[item.status][locale]}</Tag>
                              </Flex>
                              <Typography.Text>{item.detail}</Typography.Text>
                              <Flex gap={8} wrap>
                                <Button
                                  onClick={() => {
                                    const task = visibleTasks.find((candidate) => candidate.id === item.taskId);
                                    if (!task) return;
                                    const requirement = visibleRequirements.find((candidate) => candidate.latestAttemptId === task.id || candidate.attempts.some((attempt) => attempt.id === task.id));
                                    if (!requirement) return;
                                    openRequirement(requirement);
                                  }}
                                >
                                  {locale === "zh-CN" ? "打开需求" : "Open requirement"}
                                </Button>
                                <Button type="primary" ghost onClick={() => dismissAnomaly(item)}>
                                  {locale === "zh-CN" ? "标记已处理" : "Mark handled"}
                                </Button>
                              </Flex>
                            </Space>
                          </Card>
                        ))
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "当前没有异常需求" : "No anomalies"} />
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === "tools" ? (
              <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
                <SectionHeader title={locale === "zh-CN" ? "工具路由" : "Tool routes"} />
                {tools.length ? (
                  <List
                    dataSource={tools}
                    renderItem={(tool) => (
                      <List.Item>
                        <Card size="small" className="list-card full-width">
                          <Space direction="vertical" size={8} className="full-width">
                            <Typography.Text strong>{tool.name}</Typography.Text>
                            <Typography.Text type="secondary">
                              {tool.description || (locale === "zh-CN" ? "无描述" : "No description")}
                            </Typography.Text>
                            <a className="wrap-anywhere" href={tool.route} target="_blank" rel="noreferrer">
                              {locale === "zh-CN" ? `打开 ${tool.route}` : `Open ${tool.route}`}
                            </a>
                          </Space>
                        </Card>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description={locale === "zh-CN" ? "暂无工具路由" : "No tools"} />
                )}
              </Card>
            ) : null}

            {activeTab === "usage" ? (
              <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
                <SectionHeader title={locale === "zh-CN" ? "运行用量快照" : "Usage snapshot"} />
                <div className="metric-grid metric-grid-wide">
                  {usageLimitSnapshots.map((item) => (
                    <MetricCard
                      key={item.key}
                      subtitle={item.subtitle}
                      title={item.title}
                      value={item.percentLabel}
                      badge={item.sourceLabel}
                      extra={
                        <>
                          <Progress percent={item.progressValue} size="small" showInfo={false} />
                          <Flex justify="space-between" gap={12} wrap>
                            <Typography.Text type="secondary">
                              {item.available ? item.detail : locale === "zh-CN" ? "当前接口暂无该窗口数据" : "This API does not currently expose this window"}
                            </Typography.Text>
                            <Typography.Text type="secondary">{item.resetText}</Typography.Text>
                          </Flex>
                        </>
                      }
                    />
                  ))}
                </div>

                <div className="metric-grid metric-grid-summary">
                  <MetricCard
                    subtitle={locale === "zh-CN" ? "摘要" : "Summary"}
                    title={locale === "zh-CN" ? "用量说明" : "Usage overview"}
                    value={usageSummary || (locale === "zh-CN" ? "暂无用量摘要。" : "No usage summary.")}
                    valueTone="body"
                    className="usage-summary-card"
                  />
                </div>

                <SectionHeader title={locale === "zh-CN" ? "运行指标" : "Runtime metrics"} />
                {usage ? (
                  <div className="metric-grid">
                    {[
                      { label: locale === "zh-CN" ? "总任务数" : "Total tasks", value: usage.totalTasks, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "活动任务" : "Active tasks", value: usage.activeTasks, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "待审批" : "Pending approvals", value: usage.pendingApprovals, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "已完成" : "Completed", value: usage.completedTasks, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "失败" : "Failed", value: usage.failedTasks, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "预估 token" : "Token estimate", value: usage.estimatedTokens, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "Worker 运行次数" : "Worker runs", value: usage.totalRuns, valueTone: "compact" as const },
                      { label: locale === "zh-CN" ? "最近运行" : "Last run", value: usage.lastRunAt || "n/a", valueTone: "body" as const },
                    ].map((item) => (
                      <MetricCard
                        key={item.label}
                        subtitle={item.label}
                        value={String(item.value)}
                        valueTone={item.valueTone}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty description={locale === "zh-CN" ? "暂无用量数据" : "No usage data"} />
                )}

                <SectionHeader title={locale === "zh-CN" ? "平台健康" : "Platform health"} />
                {platformHealth ? (
                  <div className="metric-grid">
                    {[
                      { label: locale === "zh-CN" ? "任务后端" : "Task backend", value: platformHealth.taskBackend || "n/a", valueTone: "body" as const },
                      { label: locale === "zh-CN" ? "Issue Poller" : "Issue poller", value: platformHealth.issuePoller.status, valueTone: "compact" as const },
                      {
                        label: locale === "zh-CN" ? "轮询周期" : "Poll interval",
                        value: platformHealth.issuePoller.intervalMs ? `${platformHealth.issuePoller.intervalMs}ms` : "n/a",
                        valueTone: "compact" as const,
                      },
                      {
                        label: locale === "zh-CN" ? "最近成功轮询" : "Last poll success",
                        value: platformHealth.issuePoller.lastSuccessAt || "n/a",
                        valueTone: "body" as const,
                      },
                      {
                        label: locale === "zh-CN" ? "GitHub API 余量" : "GitHub API remaining",
                        value: platformHealth.githubApi.remaining ?? "n/a",
                        valueTone: "compact" as const,
                      },
                      {
                        label: locale === "zh-CN" ? "最近发布方式" : "Last publish method",
                        value: platformHealth.publishing.lastPublishMethod || "n/a",
                        valueTone: "body" as const,
                      },
                      {
                        label: locale === "zh-CN" ? "待验收需求" : "Awaiting acceptance",
                        value: platformHealth.taskState.awaitingAcceptance,
                        valueTone: "compact" as const,
                      },
                      {
                        label: locale === "zh-CN" ? "待返修需求" : "Needs revision",
                        value: platformHealth.taskState.needsRevision + platformHealth.taskState.publishFailed,
                        valueTone: "compact" as const,
                      },
                    ].map((item) => (
                      <MetricCard
                        key={item.label}
                        subtitle={item.label}
                        value={String(item.value)}
                        valueTone={item.valueTone}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty description={locale === "zh-CN" ? "暂无平台健康数据" : "No platform health data"} />
                )}

                <SectionHeader title={locale === "zh-CN" ? "异常与风险" : "Anomalies and risks"} />
                {platformHealth?.anomalies?.length ? (
                  <div className="section-stack">
                    {platformHealth.anomalies.map((anomaly) => (
                      <Alert
                        key={anomaly.id}
                        type={anomaly.severity === "high" ? "error" : anomaly.severity === "medium" ? "warning" : "info"}
                        showIcon
                        message={`${anomaly.id} · ${anomaly.count} · ${anomaly.severity}`}
                        description={
                          <Space direction="vertical" size={6}>
                            <Typography.Text>{anomaly.description}</Typography.Text>
                            {(anomaly.taskIds?.length ?? 0) > 0 ? <Typography.Text type="secondary">{anomaly.taskIds.join(", ")}</Typography.Text> : null}
                          </Space>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty description={locale === "zh-CN" ? "当前没有异常项" : "No anomalies detected"} />
                )}
              </Card>
            ) : null}

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
                getProjectDisplayName={getProjectDisplayName}
              />
            ) : null}
          </div>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
