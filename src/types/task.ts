// task domain types

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

export type TaskLogFeed = {
  logs: TaskLog[];
  total: number;
  returned: number;
  limit: number;
  loadedFrom: number;
  nextCursor: number;
  hasMore: boolean;
  truncated: boolean;
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
  logTotal?: number;
  logLoadedFrom?: number;
  logNextCursor?: number;
  logTruncated?: boolean;
  logHasMore?: boolean;
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

