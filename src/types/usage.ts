// usage domain types

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

