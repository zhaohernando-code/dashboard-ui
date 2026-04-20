import type { DashboardCopy } from "./dashboardConstants";
import type {
  Approval,
  CreateDialogMode,
  CreateProjectValues,
  CreateTaskValues,
  Locale,
  PlatformHealth,
  Project,
  Requirement,
  StatusFilterValue,
  Task,
  TaskPendingActionPhase,
  TaskPendingActionType,
  TaskQueueItem,
  TaskStatus,
  ToolLink,
  UsageOverview,
  WatchdogOverview,
  WatchdogSession,
  WorkspaceAnomaly,
  WorkspaceLevel,
} from "./dashboardTypes";

export type PendingTaskMutation = {
  taskId: string;
  issueNumber?: number;
  lookupKey: string;
  actionType: TaskPendingActionType;
  phase: TaskPendingActionPhase;
  startedAt: string;
  acceptedAt?: string;
  timeoutAt?: string;
  baseStatus?: TaskStatus;
  baseUpdatedAt?: string;
  baseLastStatusCommentAt?: string;
  basePlanPreview?: string;
  taskType?: string;
  executionMode?: string;
  executionGate?: boolean;
  resumeEligible?: boolean;
  placeholderTask?: Task;
};

export type TaskSyncTrigger = "auto" | "manual";

export type TaskSyncState = {
  inFlight: boolean;
  trigger?: TaskSyncTrigger;
};

export type DashboardBreadcrumb = {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
};

export type DashboardUsageLimitSnapshot = {
  key: string;
  title: string;
  subtitle: string;
  available: boolean;
  percentLabel: string;
  progressValue: number;
  resetText: string;
  detail: string;
  sourceLabel: string;
};

export type DashboardUsageModelStatusSnapshot = {
  key: string;
  model: string;
  available: boolean;
  sourceLabel: string;
  collectedAtText: string;
  emptyText: string;
  lines: DashboardUsageLimitSnapshot[];
};

export type TaskStatusDisplayState = Pick<Task, "status" | "planDraftPending" | "pendingAction" | "executionDecisionGate" | "pendingReason" | "pendingReasonLabel" | "userAction" | "planPreview">;

export type DashboardWorkspaceViewModel = {
  locale: Locale;
  copy: DashboardCopy;
  isMobile: boolean;
  workspaceLevel: WorkspaceLevel;
  breadcrumbs: DashboardBreadcrumb[];
  workspaceTitle: string;
  workspaceDescription: string;
  createLabel: string;
  createDialogMode: CreateDialogMode | null;
  visibleProjects: Project[];
  selectedProjectId: string;
  filteredProjects: Project[];
  paginatedSelectedProjectRequirements: Requirement[];
  filteredSelectedProjectRequirements: Requirement[];
  requirementPage: number;
  requirementPageSize: number;
  selectedTask: Task | null;
  selectedRequirement: Requirement | null;
  selectedTaskDetailLoading: boolean;
  selectedTaskDetailError: string;
  selectedTaskLogsLoading: boolean;
  selectedTaskLogsError: string;
  selectedRequirementAnomalies: WorkspaceAnomaly[];
  dismissedAnomalyIds: Set<string>;
  visibleWorkspaceAnomalies: WorkspaceAnomaly[];
  visibleApprovals: Approval[];
  visibleQueueItems: TaskQueueItem[];
  taskSyncState: TaskSyncState;
  projectStatusFilter: StatusFilterValue;
  requirementStatusFilter: StatusFilterValue;
  showUnarchivedOnly: boolean;
  onProjectStatusFilterChange: (next: StatusFilterValue) => void;
  onRequirementStatusFilterChange: (next: StatusFilterValue) => void;
  onToggleShowUnarchivedOnly: (next: boolean) => void;
  onRequirementPageChange: (next: number) => void;
  onRefreshAll: () => Promise<void>;
  onRefreshTasks: () => Promise<void>;
  onOpenCreateDialog: (mode: CreateDialogMode) => void;
  onCloseCreateDialog: () => void;
  onCreateProject: (values: CreateProjectValues) => Promise<void>;
  onCreateTask: (values: CreateTaskValues) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onOpenRequirement: (requirement: Requirement) => void;
  onOpenTaskRequirement: (taskId: string) => void;
  onMutateTask: (taskId: string, action: "cancel" | "retry" | "bypass_global_verification", reason?: string) => Promise<void>;
  onRespondToTask: (taskId: string, decision: "approve" | "reject" | "feedback", feedback: string) => Promise<boolean>;
  onDismissAnomaly: (anomaly: WorkspaceAnomaly) => void;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
  getTaskDisplayedStatusText: (task: TaskStatusDisplayState, locale: Locale) => string;
  getTaskDisplayedStatusColor: (task: TaskStatusDisplayState) => string;
};

export type DashboardToolsViewModel = {
  locale: Locale;
  tools: ToolLink[];
};

export type DashboardUsageViewModel = {
  locale: Locale;
  usage: UsageOverview | null;
  usageSummary: string;
  platformHealth: PlatformHealth | null;
  usageLimitSnapshots: DashboardUsageLimitSnapshot[];
  modelStatusSnapshots: DashboardUsageModelStatusSnapshot[];
  usageRefreshing: boolean;
  onRefreshUsage: () => Promise<void>;
};

export type DashboardWatchdogViewModel = {
  locale: Locale;
  overview: WatchdogOverview | null;
  onToggleEnabled: (next: boolean) => Promise<void>;
  onAcknowledge: (jobId: string) => Promise<void>;
  onOpenTask: (taskId: string) => void;
  activeSession: WatchdogSession | null;
};
