// Common/shared dashboard types
import type { TaskStatus } from "./task";

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

