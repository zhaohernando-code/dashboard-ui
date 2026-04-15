import {
  AUTO_ROUTE_PROJECT_ID,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TASK_MODEL,
  REMOTE_PROJECT_CATALOG,
} from "./dashboardConstants";
import { taskNeedsUserAttention } from "./dashboardPendingMutations";
import type {
  Locale,
  PlanForm,
  PlanQuestion,
  Project,
  StatusFilterValue,
  Task,
  TaskStatus,
} from "./dashboardTypes";

const PROJECT_METADATA_OVERRIDES: Record<string, Partial<Pick<Project, "name" | "description" | "repository">>> = {
  "一个关于a股的当前数据和投资建议看板": {
    name: "股票看板",
    repository: "https://github.com/zhaohernando-code/project-a-a41618be",
  },
};

const DISPOSABLE_SMOKE_PROJECT_MARKERS = new Set(["smoke", "publish-smoke"]);

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

export function deriveRequestedProjectId(name: string, repository: string, allowGeneratedFallback = true) {
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

export function parseTaskType(value: string) {
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
    .toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    "create a new codex-managed project",
    "new codex-managed project request",
    "codex-managed project",
  ].some((marker) => normalized.includes(marker));
}

function extractProjectScopeItems(description: string) {
  return String(description || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .filter((line) => !isGenericProjectDescriptionLine(line))
    .slice(0, 6);
}

function summarizeProjectIntent(description: string) {
  const text = String(description || "").trim();
  if (!text) {
    return "New Codex-managed project request.";
  }
  return (
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => line && !isGenericProjectDescriptionLine(line))
    || "New Codex-managed project request."
  );
}

export function buildGithubDirectPlanPreview(input: {
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

export function buildGithubDirectUserAction(input: {
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

export function parseIssueBody(body: string) {
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

export function parseEmbeddedStatusPayload(body: string) {
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

export function normalizeRequestedModel(value: string): string {
  return String(value || "").trim() || DEFAULT_TASK_MODEL;
}

export function normalizeRequestedReasoningEffort(value: string): NonNullable<Task["reasoningEffort"]> {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "normal") {
    return "medium";
  }
  if (raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw;
  }
  return DEFAULT_REASONING_EFFORT;
}

export function buildPlanFormFromPreview(planPreview: string, locale: Locale): PlanForm | null {
  const text = String(planPreview || "").trim();
  if (!text) {
    return null;
  }
  const lines = text.split("\n");
  const isChinesePreview = /(^|\n)待确认\s*$/m.test(text);
  const heading = isChinesePreview ? "待确认" : "Open Questions";
  const sectionTitles = isChinesePreview
    ? ["目标", "一期范围", "待确认", "分阶段计划", "验证与验收", "主要风险"]
    : ["Goal", "Phase 1 Scope", "Open Questions", "Milestones", "Validation", "Key Risks"];
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex < 0) {
    return null;
  }
  const questions = [];
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (sectionTitles.includes(trimmed)) {
      break;
    }
    const bulletMatch = trimmed.match(/^-\s+(.+)$/);
    if (!bulletMatch) {
      break;
    }
    questions.push({
      id: `q-${questions.length + 1}`,
      prompt: bulletMatch[1].trim(),
      kind: "text",
      required: true,
      placeholder: isChinesePreview ? "请补充你的回复" : "Add your response",
    } satisfies PlanQuestion);
  }
  if (!questions.length) {
    return null;
  }
  return {
    title: isChinesePreview ? "待确认项" : "Open questions",
    description: locale === "zh-CN"
      ? "请先补充这些待确认项，再继续生成下一版计划。"
      : "Answer these open questions before generating the next plan draft.",
    questions,
  };
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

function createEmptyTaskStats() {
  return {
    total: 0,
    running: 0,
    failed: 0,
    waitingUser: 0,
    completed: 0,
  };
}

function applyProjectMetadataOverrides(project: Project) {
  const override = PROJECT_METADATA_OVERRIDES[project.id];
  if (!override) {
    return project;
  }
  return {
    ...project,
    name: String(override.name || project.name || "").trim() || project.id,
    description: String(override.description || project.description || "").trim(),
    repository: String(override.repository || project.repository || "").trim(),
  };
}

function createProjectRecord(project: Omit<Project, "taskStats"> | Project): Project {
  return applyProjectMetadataOverrides({
    ...project,
    toolRoute: project.toolUrl || project.toolRoute || `/tools/${project.id}`,
    taskStats: createEmptyTaskStats(),
  });
}

function shouldAdoptTaskProjectName(project: Project, nextName: string) {
  const candidate = String(nextName || "").trim();
  if (!candidate || candidate === project.id) {
    return false;
  }
  const currentName = String(project.name || "").trim();
  return !currentName || currentName === project.id;
}

function mergeTaskProjectMetadata(project: Project, task: Task) {
  const requestedName = String(task.requestedProject?.name || "").trim();
  const requestedDescription = getTaskProjectDescription(task);
  const requestedRepository = getTaskProjectRepository(task);

  if (shouldAdoptTaskProjectName(project, requestedName)) {
    project.name = requestedName;
  }
  if (!project.description && requestedDescription) {
    project.description = requestedDescription;
  }
  if (!project.repository && requestedRepository) {
    project.repository = requestedRepository;
  }
}

function isDisposableSmokeProject(project: Project) {
  const markers = [project.id, project.name]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  if (!markers.some((value) => DISPOSABLE_SMOKE_PROJECT_MARKERS.has(value))) {
    return false;
  }
  return !String(project.repository || "").trim() && !String(project.description || "").trim();
}

export function buildRemoteProjects(tasks: Task[]) {
  return mergeProjectStats([], tasks);
}

export function mergeProjectStats(baseProjects: Project[], tasks: Task[]) {
  const projectMap = new Map(
    [...REMOTE_PROJECT_CATALOG, ...baseProjects].map((project) => [
      project.id,
      createProjectRecord(project),
    ]),
  );

  for (const task of tasks) {
    if (!projectMap.has(task.projectId)) {
      projectMap.set(task.projectId, {
        id: task.projectId,
        name: getTaskProjectDisplayName(task),
        description: getTaskProjectDescription(task),
        repository: getTaskProjectRepository(task),
        toolUrl: "",
        toolRoute: `/tools/${task.projectId}`,
        type: "project",
        deploymentStatus: "",
        taskStats: createEmptyTaskStats(),
      });
    }
    const project = projectMap.get(task.projectId)!;
    mergeTaskProjectMetadata(project, task);
    project.taskStats.total += 1;
    if (task.status === "running") project.taskStats.running += 1;
    if (task.status === "failed") project.taskStats.failed += 1;
    if (taskNeedsUserAttention(task)) project.taskStats.waitingUser += 1;
    if (task.status === "completed") project.taskStats.completed += 1;
  }

  return Array.from(projectMap.values())
    .map((project) => applyProjectMetadataOverrides(project))
    .filter((project) => !isDisposableSmokeProject(project));
}

function isCompositeTask(type: string) {
  return parseTaskType(type) === "composite_task";
}

export function getTaskProjectId(type: string, rawProjectId: string) {
  const normalizedProjectId = String(rawProjectId || "").trim();
  if (isCompositeTask(type)) {
    return AUTO_ROUTE_PROJECT_ID;
  }
  return normalizedProjectId || "dashboard-ui";
}

export function getProjectDisplayName(projectId: string, locale: Locale, displayName?: string) {
  if (projectId === AUTO_ROUTE_PROJECT_ID) {
    return locale === "zh-CN" ? "AI 待判定项目" : "AI-routed";
  }
  const overrideName = String(PROJECT_METADATA_OVERRIDES[projectId]?.name || "").trim();
  if (overrideName) {
    return overrideName;
  }
  return String(displayName || "").trim() || projectId;
}

export function matchesStatusFilter(status: TaskStatus, filter: StatusFilterValue) {
  return filter === "all" || status === filter;
}
