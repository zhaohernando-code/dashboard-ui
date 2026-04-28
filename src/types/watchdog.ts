// watchdog domain types

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

