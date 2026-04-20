import { DEFAULT_TASK_MODEL, FAST_TASK_MODEL, USAGE_STATUS_MODELS } from "./dashboardConstants";
import type { DashboardUsageLimitSnapshot, DashboardUsageModelStatusSnapshot } from "./dashboardControlTypes";
import type { Locale, PlatformHealth, UsageLimitWindow, UsageModelSnapshot, UsageOverview } from "./dashboardTypes";

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
    toFiniteNumber(record.usedPercent)
    ?? toFiniteNumber(record.used_percent)
    ?? toFiniteNumber(record.percent)
    ?? toFiniteNumber(record.percentUsed);
  const usedPercent = usedPercentRaw === null
    ? null
    : usedPercentRaw > 1 && usedPercentRaw <= 100
      ? usedPercentRaw
      : usedPercentRaw <= 1
        ? usedPercentRaw * 100
        : Math.min(usedPercentRaw, 100);
  const windowMinutes =
    toFiniteNumber(record.windowMinutes)
    ?? toFiniteNumber(record.windowDurationMins)
    ?? toFiniteNumber(record.window_minutes)
    ?? toFiniteNumber(record.window)
    ?? fallbackWindowMinutes;
  const resetsAt = toIsoTimestamp(record.resetsAt ?? record.resets_at ?? record.resetAt);
  const sourceLabel =
    String(record.limitName || record.limit_name || record.limitId || record.limit_id || "").trim()
    || undefined;

  if (usedPercent === null && !resetsAt) return null;

  return {
    usedPercent,
    windowMinutes,
    resetsAt,
    sourceLabel,
  };
}

function normalizeModelKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function collectRateLimitSources(raw: unknown): Array<Record<string, unknown>> {
  const record = asRecord(raw);
  if (!record) {
    return [];
  }
  const status = asRecord(record.status);
  return [
    record,
    asRecord(record.rateLimits),
    asRecord(record.rate_limits),
    status,
    asRecord(status?.rateLimits),
    asRecord(status?.rate_limits),
  ].filter(Boolean) as Array<Record<string, unknown>>;
}

function normalizeRateLimits(raw: unknown) {
  const sources = collectRateLimitSources(raw);
  return {
    primary:
      normalizeLimitWindow(sources.map((source) => source.primary).find(Boolean), 300)
      || normalizeLimitWindow(sources.map((source) => source.fiveHour).find(Boolean), 300)
      || normalizeLimitWindow(sources.map((source) => source["5h"]).find(Boolean), 300),
    secondary:
      normalizeLimitWindow(sources.map((source) => source.secondary).find(Boolean), 10080)
      || normalizeLimitWindow(sources.map((source) => source.weekly).find(Boolean), 10080)
      || normalizeLimitWindow(sources.map((source) => source.week).find(Boolean), 10080),
  };
}

function normalizeUsageModelSnapshot(fallbackModel: string, raw: unknown): UsageModelSnapshot | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const status = asRecord(record.status);
  const rateLimits = normalizeRateLimits(record);
  const model = String(record.model || record.modelName || record.slug || record.id || fallbackModel).trim() || fallbackModel;
  const statusCollectedAt = toIsoTimestamp(
    record.statusCollectedAt
    ?? record.collectedAt
    ?? record.updatedAt
    ?? record.generatedAt
    ?? status?.statusCollectedAt
    ?? status?.collectedAt,
  );
  const statusSource =
    String(record.statusSource || record.source || status?.statusSource || status?.source || "").trim() || undefined;

  if (!rateLimits.primary && !rateLimits.secondary && !statusCollectedAt && !statusSource) {
    return null;
  }

  return {
    model,
    rateLimits,
    statusCollectedAt: statusCollectedAt || undefined,
    statusSource,
  };
}

function pickPreferredModelSnapshot(current: UsageModelSnapshot | undefined, next: UsageModelSnapshot) {
  if (!current) {
    return next;
  }

  const currentTime = Date.parse(current.statusCollectedAt || "");
  const nextTime = Date.parse(next.statusCollectedAt || "");
  if (Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime > currentTime)) {
    return next;
  }
  if (!current.rateLimits.primary && next.rateLimits.primary) {
    return next;
  }
  if (!current.rateLimits.secondary && next.rateLimits.secondary) {
    return next;
  }
  return current;
}

function collectUsageModelSnapshots(raw: unknown): UsageModelSnapshot[] {
  const record = asRecord(raw) || {};
  const status = asRecord(record.status);
  const snapshots = new Map<string, UsageModelSnapshot>();

  function addSnapshot(fallbackModel: string, candidate: unknown) {
    const normalized = normalizeUsageModelSnapshot(fallbackModel, candidate);
    if (!normalized) {
      return;
    }
    const key = normalizeModelKey(normalized.model);
    snapshots.set(key, pickPreferredModelSnapshot(snapshots.get(key), normalized));
  }

  [
    asRecord(record.modelUsage),
    asRecord(record.model_usage),
    asRecord(record.models),
    asRecord(record.rateLimitsByLimitId),
    asRecord(record.rate_limits_by_limit_id),
    asRecord(status?.modelUsage),
    asRecord(status?.model_usage),
    asRecord(status?.models),
    asRecord(status?.rateLimitsByLimitId),
    asRecord(status?.rate_limits_by_limit_id),
  ]
    .filter((container): container is Record<string, unknown> => Boolean(container))
    .forEach((container) => {
      Object.entries(container).forEach(([model, candidate]) => {
        addSnapshot(inferUsageModelName(model, candidate), candidate);
      });
    });

  [
    record.modelUsage,
    record.model_usage,
    record.models,
    status?.modelUsage,
    status?.model_usage,
    status?.models,
  ]
    .filter((container): container is unknown[] => Array.isArray(container))
    .forEach((container) => {
      container.forEach((candidate, index) => {
        const snapshot = asRecord(candidate);
        addSnapshot(
          String(snapshot?.model || snapshot?.modelName || snapshot?.slug || snapshot?.id || index),
          candidate,
        );
      });
    });

  return Array.from(snapshots.values());
}

function inferUsageModelName(key: string, candidate: unknown) {
  const record = asRecord(candidate);
  const explicitModel =
    String(record?.model || record?.modelName || record?.slug || record?.id || "").trim();
  if (explicitModel) {
    return explicitModel;
  }

  const normalizedKey = String(
    key
    || record?.limitId
    || record?.limit_id
    || record?.limitName
    || record?.limit_name
    || "",
  ).trim().toLowerCase();
  const normalizedLabel = String(record?.limitName || record?.limit_name || "").trim().toLowerCase();

  if (
    normalizedKey.includes("spark")
    || normalizedKey.includes("bengalfox")
    || normalizedLabel.includes("spark")
    || normalizedLabel.includes("fast")
  ) {
    return FAST_TASK_MODEL;
  }
  if (
    normalizedKey === "codex"
    || normalizedKey.includes("gpt-5.4")
    || normalizedLabel.includes("gpt-5.4")
    || normalizedLabel.includes("codex")
  ) {
    return DEFAULT_TASK_MODEL;
  }
  return key;
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

function formatUsageSnapshotTime(value: string, locale: Locale) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeUsageOverview(raw: unknown): UsageOverview {
  const base = asRecord(raw) || {};
  const membership =
    (base.membershipUsage && typeof base.membershipUsage === "object" ? base.membershipUsage : null)
    || (base.memberUsage && typeof base.memberUsage === "object" ? base.memberUsage : null)
    || (base.quota && typeof base.quota === "object" ? base.quota : null);
  const membershipRecord = (membership || {}) as Record<string, unknown>;

  const memberUsageUsed =
    toFiniteNumber(membershipRecord.used)
    ?? toFiniteNumber(membershipRecord.current)
    ?? toFiniteNumber(base.memberUsageUsed)
    ?? toFiniteNumber(base.quotaUsed);
  const memberUsageTotal =
    toFiniteNumber(membershipRecord.total)
    ?? toFiniteNumber(membershipRecord.limit)
    ?? toFiniteNumber(base.memberUsageTotal)
    ?? toFiniteNumber(base.quotaTotal);
  const explicitRatio =
    toFiniteNumber(membershipRecord.ratio)
    ?? toFiniteNumber(base.memberUsageRatio)
    ?? toFiniteNumber(base.quotaRatio);
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
      membershipRecord.reason
      || membershipRecord.unavailableReason
      || base.memberUsageReason
      || base.quotaReason
      || "",
    ).trim() || undefined;
  const rateLimits = normalizeRateLimits(base);
  const modelSnapshots = collectUsageModelSnapshots(base);

  const totalTasks = toFiniteNumber(base.totalTasks) ?? 0;
  const successfulTasks =
    toFiniteNumber(base.successfulTasks)
    ?? toFiniteNumber(base.succeededTasks)
    ?? toFiniteNumber(base.completedTasks)
    ?? 0;
  const cancelledTasks = toFiniteNumber(base.cancelledTasks) ?? 0;
  const archivedTasks = toFiniteNumber(base.archivedTasks) ?? successfulTasks + cancelledTasks;
  const inferredUnarchivedTasks = totalTasks || archivedTasks ? Math.max(totalTasks - archivedTasks, 0) : null;
  const unarchivedTasks =
    toFiniteNumber(base.unarchivedTasks)
    ?? inferredUnarchivedTasks
    ?? toFiniteNumber(base.activeTasks)
    ?? 0;

  return {
    totalTasks,
    unarchivedTasks,
    archivedTasks,
    pendingTasks:
      toFiniteNumber(base.pendingTasks)
      ?? toFiniteNumber(base.pending)
      ?? toFiniteNumber(base.queuedTasks)
      ?? 0,
    runningTasks:
      toFiniteNumber(base.runningTasks)
      ?? toFiniteNumber(base.running)
      ?? toFiniteNumber(base.activeTasks)
      ?? 0,
    waitingTasks:
      toFiniteNumber(base.waitingTasks)
      ?? toFiniteNumber(base.pendingApprovals)
      ?? toFiniteNumber(base.waiting)
      ?? toFiniteNumber(base.blockedTasks)
      ?? 0,
    awaitingAcceptanceTasks:
      toFiniteNumber(base.awaitingAcceptanceTasks)
      ?? toFiniteNumber(base.awaitingAcceptance)
      ?? 0,
    successfulTasks,
    cancelledTasks,
    estimatedTokens: toFiniteNumber(base.estimatedTokens) ?? 0,
    totalRuns: toFiniteNumber(base.totalRuns) ?? 0,
    lastRunAt: String(base.lastRunAt || ""),
    memberUsageUsed,
    memberUsageTotal,
    memberUsageRatio,
    memberUsageUnit: String(membershipRecord.unit || base.memberUsageUnit || base.quotaUnit || "").trim() || undefined,
    memberUsageReason,
    rateLimits,
    modelSnapshots,
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
    : overview.memberUsageReason
      || (locale === "zh-CN"
        ? `已拿到运行统计${statusSnapshotTime ? `，最近一次 CLI 状态快照时间为 ${statusSnapshotTime}` : ""}，但接口没有返回当前会员的算力已用/总量。`
        : `Runtime statistics loaded${statusSnapshotTime ? ` from the latest CLI status snapshot at ${statusSnapshotTime}` : ""}, but the API did not return current member used/total quota.`);
}

export function normalizePlatformHealth(raw: unknown): PlatformHealth | null {
  const record = asRecord(raw);
  if (!record) return null;

  const githubApi = asRecord(record.githubApi) || {};
  const publishing = asRecord(record.publishing) || {};
  const taskState = asRecord(record.taskState) || {};
  const anomalies = Array.isArray(record.anomalies) ? record.anomalies : [];

  return {
    generatedAt: String(record.generatedAt || ""),
    taskBackend: String(record.taskBackend || ""),
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
      lastPublishBaselineRef: String(publishing.lastPublishBaselineRef || ""),
      lastPublishBaselineSha: String(publishing.lastPublishBaselineSha || ""),
      lastPublishSourceSha: String(publishing.lastPublishSourceSha || ""),
      lastReleaseBundleAsset: String(publishing.lastReleaseBundleAsset || ""),
      lastGuardrailStatus: String(publishing.lastGuardrailStatus || ""),
      publishedTasks: toFiniteNumber(publishing.publishedTasks) ?? 0,
      noopTasks: toFiniteNumber(publishing.noopTasks) ?? 0,
      unverifiedSuccessTasks:
        toFiniteNumber(publishing.unverifiedSuccessTasks)
        ?? toFiniteNumber(publishing.completedWithoutVerifiedPublish)
        ?? 0,
    },
    taskState: {
      total: toFiniteNumber(taskState.total) ?? 0,
      pending: toFiniteNumber(taskState.pending) ?? 0,
      running: toFiniteNumber(taskState.running) ?? 0,
      waiting: toFiniteNumber(taskState.waiting) ?? toFiniteNumber(taskState.waitingUser) ?? 0,
      awaitingAcceptance: toFiniteNumber(taskState.awaitingAcceptance) ?? 0,
      succeeded: toFiniteNumber(taskState.succeeded) ?? toFiniteNumber(taskState.completed) ?? 0,
      cancelled: toFiniteNumber(taskState.cancelled) ?? 0,
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

function buildUsageLimitSnapshot(
  item: {
    key: string;
    title: string;
    subtitle: string;
    snapshot: UsageLimitWindow | null | undefined;
  },
  locale: Locale,
): DashboardUsageLimitSnapshot {
  const percent = item.snapshot?.usedPercent ?? null;
  const clampedPercent = percent === null ? 0 : Math.max(0, Math.min(percent, 100));
  const resetText = item.snapshot?.resetsAt
    ? formatUsageLimitReset(item.snapshot.resetsAt, locale)
    : locale === "zh-CN"
      ? "接口未返回重置时间"
      : "The API did not return a reset time";

  return {
    key: item.key,
    title: item.title,
    subtitle: item.subtitle,
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
}

export function buildUsageLimitSnapshots(usage: UsageOverview | null, locale: Locale): DashboardUsageLimitSnapshot[] {
  return [
    {
      key: "primary",
      title: "5h limit",
      subtitle: locale === "zh-CN" ? "主窗口" : "Primary window",
      snapshot: usage?.rateLimits?.primary,
    },
    {
      key: "secondary",
      title: "Weekly limit",
      subtitle: locale === "zh-CN" ? "周窗口" : "Secondary window",
      snapshot: usage?.rateLimits?.secondary,
    },
  ].map((item) => buildUsageLimitSnapshot(item, locale));
}

export function buildModelStatusSnapshots(
  usage: UsageOverview | null,
  locale: Locale,
): DashboardUsageModelStatusSnapshot[] {
  const modelSnapshots = usage?.modelSnapshots || [];
  const snapshotsByModel = new Map(modelSnapshots.map((snapshot) => [normalizeModelKey(snapshot.model), snapshot]));
  const globalOnly = Boolean(
    (usage?.rateLimits?.primary || usage?.rateLimits?.secondary || usage?.statusCollectedAt)
    && !modelSnapshots.length,
  );

  return USAGE_STATUS_MODELS.map((model) => {
    const snapshot = snapshotsByModel.get(normalizeModelKey(model));
    const available = Boolean(snapshot?.rateLimits.primary || snapshot?.rateLimits.secondary);
    const collectedAt = formatUsageSnapshotTime(snapshot?.statusCollectedAt || "", locale);
    const sourceLabel = available
      ? snapshot?.rateLimits.primary?.sourceLabel
        || snapshot?.rateLimits.secondary?.sourceLabel
        || (snapshot?.statusSource ? "CLI /status" : "")
      : "";

    return {
      key: model,
      model: snapshot?.model || model,
      available,
      sourceLabel,
      collectedAtText: collectedAt
        ? locale === "zh-CN"
          ? `快照时间 ${collectedAt}`
          : `Snapshot ${collectedAt}`
        : "",
      emptyText: globalOnly
        ? locale === "zh-CN"
          ? "当前接口只返回全局 CLI 快照，尚未按 model 拆分当前用量。"
          : "The current API only returns a global CLI snapshot and has not split usage by model yet."
        : locale === "zh-CN"
          ? "当前还没有该 model 的 CLI /status 快照。"
          : "A CLI /status snapshot for this model is not available yet.",
      lines: [
        buildUsageLimitSnapshot(
          {
            key: `${model}-primary`,
            title: "5h limit",
            subtitle: locale === "zh-CN" ? "主窗口" : "Primary window",
            snapshot: snapshot?.rateLimits.primary,
          },
          locale,
        ),
        buildUsageLimitSnapshot(
          {
            key: `${model}-secondary`,
            title: "Weekly limit",
            subtitle: locale === "zh-CN" ? "周窗口" : "Secondary window",
            snapshot: snapshot?.rateLimits.secondary,
          },
          locale,
        ),
      ],
    };
  });
}
