import type { WatchdogFinding, WatchdogOverview, WatchdogSession } from "./dashboardTypes";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeFinding(raw: unknown): WatchdogFinding {
  const record = asRecord(raw) || {};
  return {
    code: String(record.code || "").trim(),
    severity: String(record.severity || "warning").trim(),
    repairable: Boolean(record.repairable),
    summary: String(record.summary || "").trim(),
    detail: String(record.detail || "").trim() || undefined,
  };
}

function normalizeSession(raw: unknown): WatchdogSession {
  const record = asRecord(raw) || {};
  const findings = Array.isArray(record.findings) ? record.findings.map(normalizeFinding) : [];
  return {
    id: String(record.id || "").trim(),
    taskId: String(record.taskId || "").trim(),
    taskTitle: String(record.taskTitle || "").trim(),
    projectId: String(record.projectId || "").trim(),
    projectName: String(record.projectName || "").trim(),
    triggerFromStatus: String(record.triggerFromStatus || "").trim(),
    triggerToStatus: String(record.triggerToStatus || "").trim(),
    triggerOrigin: String(record.triggerOrigin || "").trim() || undefined,
    status: String(record.status || "").trim(),
    phase: String(record.phase || "").trim(),
    summary: String(record.summary || "").trim(),
    findings,
    cycleCount: typeof record.cycleCount === "number" ? record.cycleCount : 0,
    requiresAcknowledgement: Boolean(record.requiresAcknowledgement),
    acknowledgedAt: String(record.acknowledgedAt || "").trim() || undefined,
    externalInput: String(record.externalInput || "").trim() || undefined,
    startedAt: String(record.startedAt || "").trim(),
    updatedAt: String(record.updatedAt || "").trim(),
    completedAt: String(record.completedAt || "").trim() || undefined,
    queuePaused: Boolean(record.queuePaused),
  };
}

export function normalizeWatchdogOverview(raw: unknown): WatchdogOverview | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  return {
    enabled: Boolean(record.enabled),
    queuePaused: Boolean(record.queuePaused),
    pauseReason: String(record.pauseReason || "").trim(),
    activeSession: record.activeSession ? normalizeSession(record.activeSession) : null,
    recentSessions: Array.isArray(record.recentSessions) ? record.recentSessions.map(normalizeSession) : [],
  };
}
