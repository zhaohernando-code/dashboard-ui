import type { Locale, TaskLog } from "./dashboardTypes";

export type LogTrack = "operator" | "raw";

export type LogViews = {
  operator: TaskLog[];
  raw: TaskLog[];
  preview: TaskLog[];
  previewTrack: LogTrack;
  hiddenCount: number;
  hasOverflow: boolean;
  hasStructuredOperatorLogs: boolean;
};

const LOG_PREVIEW_LIMIT = 4;

const fallbackImportantMarkers = [
  "waiting for explicit approval",
  "task accepted",
  "task approved",
  "task rejected",
  "task execution started",
  "task failed",
  "task stopped",
  "task moved to",
  "publish",
  "warning",
  "error",
  "failed",
  "completed",
  "needs revision",
  "awaiting acceptance",
  "项目流",
  "当前步骤",
  "等待你",
  "发布",
  "失败",
  "完成",
  "停止",
  "验收",
  "决策",
  "仓库",
];

const noisyFallbackMarkers = [
  "project flow coordinator resumed",
  "project flow re-queued during server recovery",
  "task left running for recovery finalization after server restart",
  "codex worker process spawned",
  "codex exec profile",
  "execution profile",
  "workspace prepared",
  "remote fetch attempt",
  "task branch base resolved",
  "task branch refreshed against",
  "recovered stale running task",
];

function isFallbackOperatorLog(entry: TaskLog) {
  const normalized = String(entry.message || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (noisyFallbackMarkers.some((marker) => normalized.includes(marker))) {
    return false;
  }
  return fallbackImportantMarkers.some((marker) => normalized.includes(marker));
}

function capPreview(logs: TaskLog[]) {
  return logs.slice(Math.max(0, logs.length - LOG_PREVIEW_LIMIT));
}

export function buildLogViews(logs: TaskLog[]): LogViews {
  const normalizedLogs = (logs || []).map((entry) => ({
    ...entry,
    audience: entry.audience === "operator" ? ("operator" as const) : ("raw" as const),
  }));
  const operatorLogs = normalizedLogs.filter((entry) => entry.audience === "operator");
  const fallbackOperatorLogs = operatorLogs.length ? operatorLogs : normalizedLogs.filter((entry) => isFallbackOperatorLog(entry));
  const previewSource = fallbackOperatorLogs.length ? fallbackOperatorLogs : normalizedLogs;
  const preview = capPreview(previewSource);
  return {
    operator: fallbackOperatorLogs,
    raw: normalizedLogs,
    preview,
    previewTrack: fallbackOperatorLogs.length ? "operator" : "raw",
    hiddenCount: Math.max(0, previewSource.length - preview.length),
    hasOverflow: previewSource.length > preview.length,
    hasStructuredOperatorLogs: operatorLogs.length > 0,
  };
}

export function getLogTrackLabel(track: LogTrack, locale: Locale) {
  if (track === "operator") {
    return locale === "zh-CN" ? "操作者日志" : "Operator logs";
  }
  return locale === "zh-CN" ? "原始工程日志" : "Raw engineering logs";
}

export function getLogSummaryText(logViews: LogViews, locale: Locale) {
  const operatorCount = logViews.operator.length;
  const rawCount = logViews.raw.length;
  if (locale === "zh-CN") {
    if (logViews.hasStructuredOperatorLogs) {
      return `默认显示 ${operatorCount} 条操作者日志摘要，完整日志 ${rawCount} 条。`;
    }
    return `当前任务还没有结构化操作者日志，默认从 ${rawCount} 条原始日志里收起展示最近进展。`;
  }
  if (logViews.hasStructuredOperatorLogs) {
    return `Showing ${operatorCount} operator logs by default, with ${rawCount} total logs available.`;
  }
  return `Structured operator logs are not available for this task yet, so the preview falls back to recent raw logs from ${rawCount} entries.`;
}
