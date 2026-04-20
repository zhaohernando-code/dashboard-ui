import type { AuthConfig, CopyState, DeviceLoginSession, Locale, NoticeItem, Project, StatusLabelMap, StatusTagColorMap, ThemeMode } from "./dashboardTypes";

export const DEFAULT_API_BASE =
  (import.meta.env.VITE_DEFAULT_API_BASE as string | undefined)?.trim()
  || (import.meta.env.DEV ? "http://localhost:8787" : "");
export const AUTO_ROUTE_PROJECT_ID = "__auto_route__";
export const CLOSED_ANOMALIES_STORAGE_KEY = "codex.dismissedAnomalies";
export const STATUS_FILTER_ALL = "all";
export const DEFAULT_TASK_MODEL = "gpt-5.4";
export const FAST_TASK_MODEL = "gpt-5.3-codex-spark";
export const FAST_SPEED_TIER = "fast";
export const DEFAULT_REASONING_EFFORT = "high";
export const REQUIREMENT_PAGE_SIZE_DESKTOP = 8;
export const REQUIREMENT_PAGE_SIZE_MOBILE = 6;
export const DASHBOARD_POLL_INTERVAL_MS = 5_000;
export const DASHBOARD_EXPEDITED_POLL_INTERVAL_MS = 4_000;
export const DASHBOARD_EXPEDITED_POLL_DURATION_MS = 15_000;
export const TASK_MODEL_OPTIONS = [
  { label: DEFAULT_TASK_MODEL, value: DEFAULT_TASK_MODEL },
  { label: FAST_TASK_MODEL, value: FAST_TASK_MODEL },
] as const;
export const USAGE_STATUS_MODELS = [DEFAULT_TASK_MODEL, FAST_TASK_MODEL] as const;

export const REMOTE_PROJECT_CATALOG = [
  {
    id: "dashboard-ui",
    name: "dashboard-ui",
    description: "Self-hosted dashboard for local control-plane projects and tasks.",
    repository: "https://github.com/zhaohernando-code/dashboard-ui",
    toolRoute: "/tools/dashboard-ui",
    type: "ui",
    deploymentStatus: "ready",
  },
  {
    id: "local-control-server",
    name: "local-control-server",
    description: "Local orchestration server that manages projects, tasks, approvals, and publishing.",
    repository: "https://github.com/zhaohernando-code/local-control-server",
    toolRoute: "/tools/local-control-server",
    type: "service",
  },
] satisfies Array<Pick<Project, "id" | "name" | "description" | "repository" | "toolRoute" | "type" | "deploymentStatus">>;

export const tabs = [
  { id: "quest-center", label: { "zh-CN": "工作台", "en-US": "Workspace" } },
  { id: "watchdog", label: { "zh-CN": "看护", "en-US": "Watchdog" } },
  { id: "tools", label: { "zh-CN": "工具入口", "en-US": "Tools" } },
  { id: "usage", label: { "zh-CN": "用量概览", "en-US": "Usage" } },
] as const;

export type DashboardTabId = (typeof tabs)[number]["id"];

export const statusLabel: StatusLabelMap = {
  pending: { "zh-CN": "待执行", "en-US": "Queued" },
  running: { "zh-CN": "执行中", "en-US": "Running" },
  waiting: { "zh-CN": "待处理", "en-US": "Pending" },
  awaiting_acceptance: { "zh-CN": "待验收", "en-US": "Awaiting acceptance" },
  succeeded: { "zh-CN": "成功", "en-US": "Succeeded" },
  cancelled: { "zh-CN": "已取消", "en-US": "Cancelled" },
  pending_capture: { "zh-CN": "待执行", "en-US": "Queued" },
  blocked: { "zh-CN": "待处理", "en-US": "Pending" },
  waiting_user: { "zh-CN": "待处理", "en-US": "Pending" },
  needs_revision: { "zh-CN": "待处理", "en-US": "Pending" },
  publish_failed: { "zh-CN": "待处理", "en-US": "Pending" },
  superseded: { "zh-CN": "已取消", "en-US": "Cancelled" },
  implemented: { "zh-CN": "待验收", "en-US": "Awaiting acceptance" },
  failed: { "zh-CN": "待处理", "en-US": "Pending" },
  completed: { "zh-CN": "成功", "en-US": "Succeeded" },
  stopped: { "zh-CN": "待处理", "en-US": "Pending" },
};

export const statusTagColor: StatusTagColorMap = {
  pending: "blue",
  running: "processing",
  waiting: "orange",
  awaiting_acceptance: "gold",
  succeeded: "success",
  cancelled: "default",
  pending_capture: "blue",
  blocked: "orange",
  waiting_user: "orange",
  needs_revision: "orange",
  publish_failed: "orange",
  superseded: "default",
  implemented: "gold",
  failed: "orange",
  completed: "success",
  stopped: "orange",
};

const UNKNOWN_STATUS_LABEL: Record<Locale, string> = {
  "zh-CN": "未知状态",
  "en-US": "Unknown",
};

export function getStatusLabelText(status: string | undefined, locale: Locale) {
  return statusLabel[status as keyof typeof statusLabel]?.[locale] || UNKNOWN_STATUS_LABEL[locale];
}

export function getStatusTagTone(status: string | undefined) {
  return statusTagColor[status as keyof typeof statusTagColor] || "default";
}

export type DashboardCopy = {
  title: string;
  subtitle: string;
  authDisabled: string;
  authRequired: string;
  loginButton: string;
  logoutButton: string;
  refresh: string;
  taskDetails: string;
  pendingApprovals: string;
  noTask: string;
  mobileControlTitle: string;
  themeSetting: string;
  languageSetting: string;
  watchdogSetting: string;
};

export function getDashboardCopy(locale: Locale): DashboardCopy {
  return {
    title: locale === "zh-CN" ? "Codex 控制中台" : "Codex Control Center",
    subtitle:
      locale === "zh-CN"
        ? "项目、任务、待处理与运行数据统一管理"
        : "Unified workspace for projects, tasks, pending work, and usage",
    authDisabled:
      locale === "zh-CN"
        ? "当前服务未启用登录，可直接使用看板。"
        : "Authentication disabled by server. Dashboard is open.",
    authRequired:
      locale === "zh-CN"
        ? "未登录也可进入看板，涉及仓库自动化的操作会受限。"
        : "You can browse without sign-in; repo automation requires authentication.",
    loginButton: locale === "zh-CN" ? "GitHub 登录" : "Sign in with GitHub",
    logoutButton: locale === "zh-CN" ? "退出登录" : "Sign out",
    refresh: locale === "zh-CN" ? "刷新" : "Refresh",
    taskDetails: locale === "zh-CN" ? "任务详情" : "Task details",
    pendingApprovals: locale === "zh-CN" ? "待处理任务" : "Pending tasks",
    noTask: locale === "zh-CN" ? "请选择任务查看详情" : "Select one task to inspect",
    mobileControlTitle: locale === "zh-CN" ? "控制中心" : "Control center",
    themeSetting: locale === "zh-CN" ? "主题色" : "Theme",
    languageSetting: locale === "zh-CN" ? "界面语言" : "Language",
    watchdogSetting: locale === "zh-CN" ? "看护模式" : "Watchdog mode",
  };
}

export type DashboardShellViewModel = {
  locale: Locale;
  theme: ThemeMode;
  activeTab: DashboardTabId;
  isMobile: boolean;
  isMobileNavOpen: boolean;
  authConfig: AuthConfig | null;
  deviceLogin: DeviceLoginSession | null;
  copyState: CopyState;
  notices: NoticeItem[];
  copy: DashboardCopy;
  watchdogEnabled: boolean;
  watchdogActive: boolean;
  watchdogBanner: {
    title: string;
    detail: string;
    tone: "info" | "warning";
    sessionId?: string;
    requiresAcknowledgement?: boolean;
  } | null;
  onToggleTheme: () => void;
  onChangeLocale: (next: Locale) => void;
  onChangeTab: (next: DashboardTabId) => void;
  onToggleWatchdog: (next: boolean) => void | Promise<void>;
  onAcknowledgeWatchdog: (jobId: string) => void | Promise<void>;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  onLogin: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onCopyDeviceCode: () => void | Promise<void>;
  onCancelDeviceLogin: () => void;
};
