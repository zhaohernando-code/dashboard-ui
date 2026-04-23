export type TaskStatus =
  | "pending"
  | "running"
  | "waiting"
  | "awaiting_acceptance"
  | "succeeded"
  | "cancelled"
  | "pending_capture"
  | "blocked"
  | "waiting_user"
  | "needs_revision"
  | "publish_failed"
  | "superseded"
  | "implemented"
  | "failed"
  | "completed"
  | "stopped";

export type TaskPendingReason = "plan_feedback" | "manual_intervention" | "user_decision" | (string & {});
export type TaskReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type TaskSpeedTier = "fast" | (string & {});

export type Project = {
  id: string;
  name: string;
  description: string;
  repository: string;
  toolRoute: string;
  toolUrl?: string;
  type?: string;
  exposureMode?: string;
  exposureBasePath?: string;
  exposureRoute?: string;
  exposureOnline?: boolean;
  exposureWorkerId?: string;
  exposureWorkerLabel?: string;
  upstreamLoopbackPort?: string;
  apiUpstreamLoopbackPort?: string;
  deploymentProvider?: string;
  deploymentStatus?: string;
  deploymentError?: string;
  localRuntime?: {
    enabled?: boolean;
    mode?: string;
    exposureBasePath?: string;
    localProjectPath?: string;
    frontendLocalPort?: string;
    frontendRemotePort?: string;
    apiLocalPort?: string;
    apiRemotePort?: string;
    status?: string;
    lastError?: string;
    lastAppliedAt?: string;
    envFile?: string;
    plistFile?: string;
    launchAgentLabel?: string;
    workerId?: string;
  };
  taskStats: {
    total: number;
    pending: number;
    running: number;
    waiting: number;
    awaitingAcceptance: number;
    succeeded: number;
    cancelled: number;
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
  audience?: "operator" | "raw";
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

export type TaskPendingActionType =
  | "create_project"
  | "create_task"
  | "feedback"
  | "approve"
  | "reject"
  | "retry"
  | "bypass_global_verification"
  | "cancel";

export type TaskPendingActionPhase = "submitting" | "waiting_remote" | "timed_out";

export type TaskPendingAction = {
  type: TaskPendingActionType;
  phase: TaskPendingActionPhase;
  startedAt: string;
  label: string;
  message: string;
  blocksActions?: boolean;
  hideFromApprovals?: boolean;
};

export type ProjectExecutionStep = {
  id: string;
  type: "setup" | "research" | "implement" | "verify" | string;
  title: string;
  outcome: string;
  status: string;
  requiresDecision?: boolean;
  autoCompleted?: boolean;
  completedAt?: string;
  currentAttemptId?: string;
  lastAttemptNumber?: number;
  lastFailure?: string;
  decision?: string;
  decisionResolved?: boolean;
};

export type ProjectExecution = {
  version?: number;
  initializedAt?: string;
  currentStepId?: string;
  currentStepIndex?: number;
  researchNotes?: string;
  resumeEligible?: boolean;
  docs?: {
    planPath?: string;
    decisionsPath?: string;
    researchPath?: string;
  } | null;
  steps: ProjectExecutionStep[];
};

export type ExecutionDecisionGate = {
  stepId: string;
  title: string;
  prompt: string;
  stepType?: string;
  childTaskId?: string;
  form?: PlanForm | null;
};

export type Task = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  rawStatus?: string;
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
  pendingReason?: TaskPendingReason | null;
  pendingReasonLabel?: string;
  pendingReasonDetail?: string;
  canStartExecution?: boolean;
  pendingAction?: TaskPendingAction | null;
  lastStatusCommentAt?: string;
  planPreview: string;
  planForm?: PlanForm | null;
  planDraftPending?: boolean;
  executionMode?: string;
  projectExecution?: ProjectExecution | null;
  executionDecisionGate?: ExecutionDecisionGate | null;
  resumeEligible?: boolean;
  failureType?: string;
  failurePhase?: string;
  isInternal?: boolean;
  projectStepMeta?: {
    stepId?: string;
    stepType?: string;
    projectCreateTaskId?: string;
    requiresDecision?: boolean;
    internal?: boolean;
  } | null;
  workspacePath: string;
  branchName: string;
  model?: string;
  requestedModel?: string;
  reasoningEffort?: TaskReasoningEffort;
  planMode?: boolean;
  fastMode?: boolean;
  speedTier?: TaskSpeedTier;
  publishStatus?: string;
  publishMethod?: string;
  publishVerified?: boolean;
  healthFlags?: string[];
  openFailureReason?: string;
  acceptanceCompleted?: number;
  acceptanceTotal?: number;
  acceptanceCriteria?: Array<{ id: string; text: string }>;
  verificationResults?: Array<{ criterionId: string; type: string; status: string; evidence: string }>;
  logs: TaskLog[];
  children: TaskChild[];
  queuePosition?: number;
  queueEnteredAt?: string;
  queueName?: string;
  queueBlockedByTaskId?: string;
  queueBlockedByTaskTitle?: string;
  issueNumber?: number;
  issueUrl?: string;
  allowedActions?: string[];
  queueState?: {
    inQueue?: boolean;
    placement?: string;
    requestedAt?: string;
  } | null;
  nodeStatusSummary?: Record<string, unknown> | null;
  latestProgress?: Record<string, unknown> | null;
  latestFailure?: Record<string, unknown> | null;
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
  unarchivedTasks: number;
  archivedTasks: number;
  pendingTasks: number;
  runningTasks: number;
  waitingTasks: number;
  awaitingAcceptanceTasks: number;
  successfulTasks: number;
  cancelledTasks: number;
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
  modelSnapshots: UsageModelSnapshot[];
  statusCollectedAt?: string;
  statusSource?: string;
};

export type UsageLimitWindow = {
  usedPercent: number | null;
  windowMinutes: number | null;
  resetsAt: string;
  sourceLabel?: string;
};

export type UsageModelSnapshot = {
  model: string;
  rateLimits: {
    primary: UsageLimitWindow | null;
    secondary: UsageLimitWindow | null;
  };
  statusCollectedAt?: string;
  statusSource?: string;
};

export type PlatformHealth = {
  generatedAt: string;
  taskBackend: string;
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
    lastPublishBaselineRef?: string;
    lastPublishBaselineSha?: string;
    lastPublishSourceSha?: string;
    lastReleaseBundleAsset?: string;
    lastGuardrailStatus?: string;
    publishedTasks: number;
    noopTasks: number;
    unverifiedSuccessTasks: number;
  };
  taskState: {
    total: number;
    pending: number;
    running: number;
    waiting: number;
    awaitingAcceptance: number;
    succeeded: number;
    cancelled: number;
  };
  anomalies: Array<{
    id: string;
    severity: string;
    count: number;
    description: string;
    taskIds: string[];
  }>;
};

export type WatchdogFinding = {
  code: string;
  severity: string;
  repairable: boolean;
  summary: string;
  detail?: string;
};

export type WatchdogSession = {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  triggerFromStatus: string;
  triggerToStatus: string;
  triggerOrigin?: string;
  status: string;
  phase: string;
  summary: string;
  findings: WatchdogFinding[];
  cycleCount: number;
  requiresAcknowledgement: boolean;
  acknowledgedAt?: string;
  externalInput?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  queuePaused: boolean;
};

export type WatchdogOverview = {
  enabled: boolean;
  queuePaused: boolean;
  pauseReason: string;
  activeSession: WatchdogSession | null;
  recentSessions: WatchdogSession[];
};

export type AuthConfig = {
  enabled: boolean;
  mode: string;
  provider: string;
  hasClientId: boolean;
  repoAutomationEnabled: boolean;
  taskBackend?: string;
  user: null | {
    login: string;
    name: string;
  };
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
  enableLocalTunnel?: boolean;
  localProjectPath?: string;
  frontendLocalPort?: string;
  apiLocalPort?: string;
  model?: string;
  reasoningEffort?: TaskReasoningEffort;
  fastMode?: boolean;
};

export type CreateTaskValues = {
  projectId?: string;
  type?: string;
  title: string;
  description: string;
  model?: string;
  reasoningEffort?: TaskReasoningEffort;
  planMode?: boolean;
  fastMode?: boolean;
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

export type TaskQueueItem = {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  status: TaskStatus;
  position: number;
  queueEnteredAt?: string;
  queueName?: string;
  summary?: string;
  issueNumber?: number;
};

export type Locale = "zh-CN" | "en-US";
export type CopyState = "idle" | "copied";
export type ThemeMode = "light" | "dark";
export type WorkspaceLevel = "projects" | "tasks" | "detail";
export type CreateDialogMode = "project" | "task" | "composite_task";
export type StatusFilterValue = TaskStatus | "all";
export type StatusLabelMap = Record<TaskStatus, Record<Locale, string>>;
export type StatusTagColorMap = Record<TaskStatus, string>;
export type ToolLink = {
  id: string;
  name: string;
  route: string;
  description: string;
  repository?: string;
  deploymentProvider?: string;
  deploymentStatus?: string;
  deploymentError?: string;
  workerLabel?: string;
  exposureMode?: string;
};
