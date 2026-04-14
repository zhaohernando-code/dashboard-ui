export type TaskStatus =
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

export type Project = {
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

export type TaskChild = {
  id: string;
  title: string;
  status: TaskStatus;
};

export type TaskLog = {
  timestamp: string;
  message: string;
};

export type PlanQuestion = {
  id: string;
  prompt: string;
  description?: string;
  kind: "single_choice" | "multi_choice" | "text";
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type PlanForm = {
  title?: string;
  description?: string;
  questions: PlanQuestion[];
};

export type Task = {
  id: string;
  updatedAt?: string;
  requirementId?: string;
  attemptNumber?: number;
  projectId: string;
  projectName: string;
  requestedProject?: {
    id?: string;
    name?: string;
    description?: string;
    repository?: string;
  } | null;
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
  planForm?: PlanForm | null;
  planDraftPending?: boolean;
  workspacePath: string;
  branchName: string;
  model?: string;
  reasoningEffort?: "medium" | "high" | "xhigh";
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

export type Requirement = {
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

export type Approval = {
  id: string;
  reason: string;
  task: Task;
};

export type UsageOverview = {
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

export type UsageLimitWindow = {
  usedPercent: number | null;
  windowMinutes: number | null;
  resetsAt: string;
  sourceLabel?: string;
};

export type PlatformHealth = {
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

export type AuthConfig = {
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

export type IssueTask = {
  number: number;
  url: string;
  repo: string;
};

export type DeviceLoginSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSec: number;
  status: string;
  error: string;
};

export type CreateProjectValues = {
  name: string;
  description?: string;
  repository?: string;
  visibility?: string;
  autoCreateRepo?: boolean;
  model?: string;
  reasoningEffort?: "medium" | "high" | "xhigh";
};

export type CreateTaskValues = {
  projectId?: string;
  type?: string;
  title: string;
  description: string;
  model?: string;
  reasoningEffort?: "medium" | "high" | "xhigh";
};

export type NoticeTone = "info" | "success" | "error";

export type NoticeItem = {
  id: number;
  message: string;
  tone: NoticeTone;
};

export type DismissedAnomaly = {
  id: string;
  dismissedAt: string;
};

export type WorkspaceAnomaly = {
  id: string;
  title: string;
  status: TaskStatus;
  detail: string;
  taskId: string;
  fingerprint: string;
};

export type Locale = "zh-CN" | "en-US";
export type CopyState = "idle" | "copied";
export type ThemeMode = "light" | "dark";
export type WorkspaceLevel = "projects" | "tasks" | "detail";
export type RuntimeMode = "local-api" | "github-direct";
export type CreateDialogMode = "project" | "task" | "composite_task";
export type StatusFilterValue = TaskStatus | "all";
export type StatusLabelMap = Record<TaskStatus, Record<Locale, string>>;
export type StatusTagColorMap = Record<TaskStatus, string>;
export type ToolLink = {
  id: string;
  name: string;
  route: string;
  description: string;
};
