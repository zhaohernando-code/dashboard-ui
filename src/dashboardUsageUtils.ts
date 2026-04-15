import type { DashboardUsageLimitSnapshot } from "./dashboardControlTypes";
import { taskNeedsUserAttention } from "./dashboardPendingMutations";
import type { Locale, PlatformHealth, Requirement, Task, UsageLimitWindow, UsageOverview } from "./dashboardTypes";

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

export function formatUsageLimitReset(value: string, locale: Locale) {
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

export function normalizeUsageOverview(raw: unknown): UsageOverview {
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

export function buildUsageSummary(overview: UsageOverview, locale: Locale) {
  const hasMemberUsage = overview.memberUsageUsed !== null && overview.memberUsageTotal !== null;
  const statusSnapshotTime = overview.statusCollectedAt
    ? new Date(overview.statusCollectedAt).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return hasMemberUsage
    ? locale === "zh-CN"
      ? `当前会员算力已使用 ${overview.memberUsageUsed}${overview.memberUsageUnit ? ` ${overview.memberUsageUnit}` : ""}，总量 ${overview.memberUsageTotal}${overview.memberUsageUnit ? ` ${overview.memberUsageUnit}` : ""}。`
      : `Current member quota used: ${overview.memberUsageUsed}${overview.memberUsageUnit ? ` ${overview.memberUsageUnit}` : ""} out of ${overview.memberUsageTotal}${overview.memberUsageUnit ? ` ${overview.memberUsageUnit}` : ""}.`
    : overview.memberUsageReason ||
      (locale === "zh-CN"
        ? `已拿到运行统计${statusSnapshotTime ? `，最近一次 CLI 状态快照时间为 ${statusSnapshotTime}` : ""}，但接口没有返回当前会员的算力已用/总量。`
        : `Runtime statistics loaded${statusSnapshotTime ? ` from the latest CLI status snapshot at ${statusSnapshotTime}` : ""}, but the API did not return current member used/total quota.`);
}

export function normalizePlatformHealth(raw: unknown): PlatformHealth | null {
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

export function buildGithubDirectUsageFallback(taskList: Task[], locale: Locale): UsageOverview {
  const lastUpdatedTask = [...taskList]
    .filter((task) => task.updatedAt)
    .sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""))[0];

  return {
    totalTasks: taskList.length,
    activeTasks: taskList.filter((task) => task.status === "running").length,
    pendingApprovals: taskList.filter((task) => taskNeedsUserAttention(task)).length,
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

export function buildUsageLimitSnapshots(usage: UsageOverview | null, locale: Locale): DashboardUsageLimitSnapshot[] {
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
    } satisfies DashboardUsageLimitSnapshot;
  });
}

export function buildGithubDirectPlatformHealth(input: {
  githubTaskRepo: string;
  githubToken: string;
  locale: Locale;
  visibleTasks: Task[];
  visibleRequirements: Requirement[];
}): PlatformHealth {
  const { githubTaskRepo, githubToken, locale, visibleTasks, visibleRequirements } = input;
  return {
    generatedAt: new Date().toISOString(),
    taskBackend: "github-issues",
    githubTaskRepo,
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
      waitingUser: visibleTasks.filter((task) => taskNeedsUserAttention(task)).length,
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
  };
}
