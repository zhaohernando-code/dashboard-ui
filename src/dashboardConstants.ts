import type { AuthConfig, CopyState, DeviceLoginSession, Locale, NoticeItem, Project, RuntimeMode, StatusLabelMap, StatusTagColorMap, ThemeMode } from "./dashboardTypes";

export const DEFAULT_API_BASE = (import.meta.env.VITE_DEFAULT_API_BASE as string | undefined)?.trim() || "http://localhost:8787";
export const GITHUB_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() || "";
export const GITHUB_TASK_REPO = (import.meta.env.VITE_GITHUB_TASK_REPO as string | undefined)?.trim() || "zhaohernando-code/dashboard-ui";
export const GITHUB_STATUS_ISSUE_TITLE = (import.meta.env.VITE_GITHUB_STATUS_ISSUE_TITLE as string | undefined)?.trim() || "Codex Control Plane Status";
export const GITHUB_SCOPES = (import.meta.env.VITE_GITHUB_OAUTH_SCOPES as string | undefined)?.trim() || "read:user repo";
export const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
export const HAS_MIXED_CONTENT_LOCAL_API =
  typeof window !== "undefined"
  && window.location.protocol === "https:"
  && /^http:\/\/(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(DEFAULT_API_BASE);
export const AUTO_ROUTE_PROJECT_ID = "__auto_route__";
export const CLOSED_ANOMALIES_STORAGE_KEY = "codex.dismissedAnomalies";
export const STATUS_FILTER_ALL = "all";
export const DEFAULT_TASK_MODEL = "gpt-5.4";
export const DEFAULT_REASONING_EFFORT = "high";
export const REQUIREMENT_PAGE_SIZE_DESKTOP = 8;
export const REQUIREMENT_PAGE_SIZE_MOBILE = 6;
export const DASHBOARD_POLL_INTERVAL_MS = 5_000;
export const DASHBOARD_EXPEDITED_POLL_INTERVAL_MS = 3_000;
export const DASHBOARD_EXPEDITED_POLL_DURATION_MS = 15_000;

export const REMOTE_PROJECT_CATALOG = [
  {
    id: "dashboard-ui",
    name: "dashboard-ui",
    description: "GitHub Pages dashboard for project and issue-driven task dispatch.",
    repository: "https://github.com/zhaohernando-code/dashboard-ui",
    toolUrl: "https://zhaohernando-code.github.io/dashboard-ui/",
    toolRoute: "/tools/dashboard-ui",
    type: "ui",
    deploymentStatus: "ready",
  },
  {
    id: "local-control-server",
    name: "local-control-server",
    description: "Local poller/executor that consumes GitHub issue tasks.",
    repository: "https://github.com/zhaohernando-code/local-control-server",
    toolRoute: "/tools/local-control-server",
    type: "service",
  },
] satisfies Array<Pick<Project, "id" | "name" | "description" | "repository" | "toolRoute" | "toolUrl" | "type" | "deploymentStatus">>;

export const tabs = [
  { id: "quest-center", label: { "zh-CN": "工作台", "en-US": "Workspace" } },
  { id: "tools", label: { "zh-CN": "工具入口", "en-US": "Tools" } },
  { id: "usage", label: { "zh-CN": "用量概览", "en-US": "Usage" } },
] as const;

export type DashboardTabId = (typeof tabs)[number]["id"];

export const statusLabel: StatusLabelMap = {
  pending_capture: { "zh-CN": "待捕获", "en-US": "Awaiting pickup" },
  pending: { "zh-CN": "等待中", "en-US": "Pending" },
  running: { "zh-CN": "运行中", "en-US": "Running" },
  waiting_user: { "zh-CN": "待你确认", "en-US": "Awaiting Approval" },
  awaiting_acceptance: { "zh-CN": "待验收", "en-US": "Awaiting acceptance" },
  needs_revision: { "zh-CN": "待返修", "en-US": "Needs revision" },
  publish_failed: { "zh-CN": "发布失败", "en-US": "Publish failed" },
  superseded: { "zh-CN": "已归档", "en-US": "Superseded" },
  implemented: { "zh-CN": "已实现", "en-US": "Implemented" },
  failed: { "zh-CN": "失败", "en-US": "Failed" },
  completed: { "zh-CN": "完成", "en-US": "Completed" },
  stopped: { "zh-CN": "已停止", "en-US": "Stopped" },
};

export const statusTagColor: StatusTagColorMap = {
  pending_capture: "blue",
  pending: "orange",
  running: "processing",
  waiting_user: "purple",
  awaiting_acceptance: "gold",
  needs_revision: "volcano",
  publish_failed: "red",
  superseded: "default",
  implemented: "cyan",
  failed: "red",
  completed: "success",
  stopped: "default",
};

export type DashboardCopy = {
  title: string;
  subtitle: string;
  localApi: string;
  authDisabled: string;
  authRequired: string;
  loginButton: string;
  logoutButton: string;
  refresh: string;
  taskDetails: string;
  pendingApprovals: string;
  noTask: string;
  mobileControlTitle: string;
  mobileControlMeta: string;
  mobileViewDrawerTitle: string;
  openViewDrawer: string;
  themeSetting: string;
  languageSetting: string;
};

export function getDashboardCopy(locale: Locale): DashboardCopy {
  return {
    title: locale === "zh-CN" ? "Codex 控制中台" : "Codex Control Center",
    subtitle:
      locale === "zh-CN"
        ? "项目、任务、审批与运行数据统一管理"
        : "Unified workspace for projects, tasks, approvals and usage",
    localApi: locale === "zh-CN" ? "本地服务地址：" : "Local API:",
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
    pendingApprovals: locale === "zh-CN" ? "待处理审批" : "Pending approvals",
    noTask: locale === "zh-CN" ? "请选择任务查看详情" : "Select one task to inspect",
    mobileControlTitle: locale === "zh-CN" ? "控制中心" : "Control center",
    mobileControlMeta: locale === "zh-CN" ? "设置与账户" : "Settings & account",
    mobileViewDrawerTitle: locale === "zh-CN" ? "工作区视图" : "Workspace views",
    openViewDrawer: locale === "zh-CN" ? "切换工作区视图" : "Switch workspace view",
    themeSetting: locale === "zh-CN" ? "主题色" : "Theme",
    languageSetting: locale === "zh-CN" ? "界面语言" : "Language",
  };
}

export type DashboardShellViewModel = {
  runtimeMode: RuntimeMode;
  locale: Locale;
  theme: ThemeMode;
  activeTab: DashboardTabId;
  isMobile: boolean;
  isMobileNavOpen: boolean;
  isMobileViewDrawerOpen: boolean;
  authConfig: AuthConfig | null;
  deviceLogin: DeviceLoginSession | null;
  copyState: CopyState;
  notices: NoticeItem[];
  copy: DashboardCopy;
  apiBaseLabel: string;
  onToggleTheme: () => void;
  onChangeLocale: (next: Locale) => void;
  onChangeTab: (next: DashboardTabId) => void;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  onOpenMobileViewDrawer: () => void;
  onCloseMobileViewDrawer: () => void;
  onLogin: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onCopyDeviceCode: () => void | Promise<void>;
  onCancelDeviceLogin: () => void;
};
