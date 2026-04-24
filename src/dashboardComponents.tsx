import { type ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Pagination,
  Radio,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import { GlobalOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";

import { DEFAULT_TASK_MODEL, FAST_TASK_MODEL, TASK_MODEL_OPTIONS } from "./dashboardConstants";
import { getLogSummaryText, getLogTrackLabel, type LogTrack, type LogViews } from "./dashboardLogs";
import {
  TASK_STATUS_ORDER,
  canCancelTask,
  getRetryActionLabel,
  getTaskPendingReason,
  getTaskPendingReasonLabel,
  isArchivedTask,
  isPublishedTaskCancellationLocked,
} from "./dashboardTaskState";
import type {
  Approval,
  PlanForm,
  PlanQuestion,
  CreateDialogMode,
  CreateProjectValues,
  CreateTaskValues,
  Locale,
  Project,
  Requirement,
  StatusFilterValue,
  StatusLabelMap,
  StatusTagColorMap,
  Task,
  TaskLog,
  WorkspaceAnomaly,
} from "./dashboardTypes";

type CreateDialogProps = {
  locale: Locale;
  mode: CreateDialogMode;
  projects: Project[];
  selectedProjectId: string;
  closeLabel: string;
  onClose: () => void;
  onCreateProject: (values: CreateProjectValues) => Promise<void>;
  onCreateTask: (values: CreateTaskValues) => Promise<void>;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
};

type StatusFilterBarProps = {
  locale: Locale;
  value: StatusFilterValue;
  onChange: (next: StatusFilterValue) => void;
  statusFilterAll: StatusFilterValue;
  statusLabel: StatusLabelMap;
};

type TaskDetailProps = {
  requirement: Requirement;
  task: Task;
  locale: Locale;
  detailLoading: boolean;
  detailError: string;
  logsLoading: boolean;
  logsError: string;
  onMutate: (taskId: string, action: "cancel" | "retry" | "bypass_global_verification", reason?: string) => Promise<void>;
  onRespond: (taskId: string, decision: "approve" | "reject" | "feedback", feedback: string) => Promise<boolean>;
  anomalies: WorkspaceAnomaly[];
  dismissedAnomalyIds: Set<string>;
  onDismissAnomaly: (anomaly: WorkspaceAnomaly) => void;
  statusLabel: StatusLabelMap;
  statusTagColor: StatusTagColorMap;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
  normalizeDisplayText: (value: string) => string;
  buildLogViews: (logs: TaskLog[]) => LogViews;
};

type ApprovalCardProps = {
  approval: Approval;
  locale: Locale;
  onOpenTask: (taskId: string) => void;
  statusLabel: StatusLabelMap;
  statusTagColor: StatusTagColorMap;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
};

type HeaderSwitchProps = {
  checked: boolean;
  label: string;
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  onToggle: () => void;
};

type HeaderLocaleSwitchProps = {
  label: string;
  value: Locale;
  onChange: (next: Locale) => void;
};

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

type MetricCardProps = {
  subtitle: string;
  title?: string;
  value: string;
  badge?: string;
  extra?: ReactNode;
  className?: string;
  valueTone?: "hero" | "compact" | "body";
};

type ListPaginationProps = {
  locale: Locale;
  current: number;
  pageSize: number;
  total: number;
  itemLabel: Record<Locale, string>;
  onChange: (page: number) => void;
};

function getDisplayedStatusText(task: Task, locale: Locale, statusLabel: StatusLabelMap) {
  if (task.pendingAction?.label) {
    return task.pendingAction.label;
  }
  if (task.planDraftPending && task.status === "waiting") {
    return locale === "zh-CN" ? "继续处理中" : "Processing";
  }
  if (task.status === "waiting") {
    return getTaskPendingReasonLabel(task, locale);
  }
  return statusLabel[task.status][locale];
}

function getDisplayedStatusColor(task: Task, statusTagColor: StatusTagColorMap) {
  if (task.pendingAction) {
    return task.pendingAction.phase === "timed_out" ? "warning" : "processing";
  }
  if (task.planDraftPending && task.status === "waiting") {
    return "processing";
  }
  return statusTagColor[task.status];
}

function formatTaskTimestamp(value: string | undefined, locale: Locale) {
  if (!value) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function findStatusTimestamp(task: Task, status: Task["status"]) {
  const pattern = new RegExp(`status changed to\\s+\`${status}\``, "i");
  const matched = [...task.logs].reverse().find((entry) => pattern.test(entry.message));
  if (matched?.timestamp) {
    return matched.timestamp;
  }
  if (task.status === status) {
    return task.updatedAt || "";
  }
  return "";
}

function getTaskFailureDiagnosis(task: Task, locale: Locale) {
  const pendingReason = getTaskPendingReason(task);
  const reason = String(task.pendingReasonDetail || task.openFailureReason || task.summary || "").trim();
  if (task.status !== "waiting" || pendingReason !== "manual_intervention") {
    return null;
  }

  if (task.executionMode === "orchestrated" && task.failureType === "step_failed") {
    const currentStep = task.projectExecution?.steps?.find((step) => step.id === task.projectExecution?.currentStepId);
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "项目流在当前步骤受阻，可继续处理"
        : "The project flow is blocked on the current step and can continue from there",
      summary: locale === "zh-CN"
        ? `当前阻塞发生在步骤「${currentStep?.title || task.failurePhase || "未知步骤"}」。继续处理不会重开任务，会直接沿当前链路往下走。`
        : `The blockage happened on "${currentStep?.title || task.failurePhase || "the current step"}". Continuing will stay on the same task history instead of reopening it.`,
      timeline: locale === "zh-CN"
        ? `最近受阻记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest blocked record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "先看下面的原因；如果方向没问题，直接点“继续处理”即可。"
        : "Read the recorded reason first. If the direction is still correct, continue from here.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  if (task.executionMode === "orchestrated" && task.failureType === "stalled_project_flow") {
    return {
      type: "warning" as const,
      title: locale === "zh-CN"
        ? "项目流失去了活动步骤，需要人工继续"
        : "The project flow lost its active step and needs manual continuation",
      summary: locale === "zh-CN"
        ? "系统没有检测到当前应该继续执行的项目步骤，所以先把任务转为待处理。"
        : "The system could not find an active step to continue, so the task was moved into pending handling.",
      timeline: locale === "zh-CN"
        ? `最近待处理记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest pending-handling record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "直接点“继续处理”即可按保留的项目流状态往下走。"
        : "Use Continue to resume from the preserved project-flow state.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  if (/prolonged inactivity without a final summary/i.test(reason)) {
    const runningAt = findStatusTimestamp(task, "running");
    const failedAt = task.updatedAt || "";
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "执行阶段长时间无进展，已转人工介入"
        : "Execution stalled and now needs manual intervention",
      summary: locale === "zh-CN"
        ? "任务进入执行后，长时间没有新的进度更新，也没有写出最终总结，所以系统把它转到了待处理。"
        : "After the task entered running, it stopped producing progress updates and never wrote a final summary, so the system moved it into pending handling.",
      timeline: locale === "zh-CN"
        ? `进入执行：${formatTaskTimestamp(runningAt, locale)}；转待处理：${formatTaskTimestamp(failedAt, locale)}`
        : `Entered running: ${formatTaskTimestamp(runningAt, locale)}; moved to pending handling: ${formatTaskTimestamp(failedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "建议先点“继续处理”或“重试”。如果再次出现，需要排查执行环境、网络访问或外部命令阻塞。"
        : "Try Continue or Retry first. If it happens again, investigate the execution environment, network access, or blocked external commands.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  const canTaskBeCancelled = canCancelTask(task);
  return {
    type: "warning" as const,
    title: locale === "zh-CN" ? "任务需要人工介入" : "The task needs manual intervention",
    summary: locale === "zh-CN"
      ? "任务没有完成，但也没有被归档。系统已经把它转为待处理，等待你决定下一步动作。"
      : "The task did not finish and has been moved into pending handling while it waits for your next action.",
    timeline: locale === "zh-CN"
      ? `最近待处理记录：${formatTaskTimestamp(task.updatedAt, locale)}`
      : `Latest pending-handling record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
    guidance: locale === "zh-CN"
      ? (canTaskBeCancelled
          ? "先看当前原因，再决定继续处理、重试，还是直接取消。"
          : "先看当前原因，再决定继续处理或重试；如果已发布结果不符合预期，请打回返修。")
      : (canTaskBeCancelled
          ? "Read the current reason first, then decide whether to continue, retry, or cancel."
          : "Read the current reason first, then continue or retry. If the published result is wrong, send it back for revision instead of cancelling."),
    rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
  };
}

export function CreateDialog({
  locale,
  mode,
  projects,
  selectedProjectId,
  closeLabel,
  onClose,
  onCreateProject,
  onCreateTask,
  getProjectDisplayName,
}: CreateDialogProps) {
  const title =
    mode === "project"
      ? locale === "zh-CN"
        ? "创建项目"
        : "Create project"
      : mode === "composite_task"
        ? locale === "zh-CN"
          ? "创建模糊/组合任务"
          : "Create composite task"
      : locale === "zh-CN"
        ? "创建任务"
        : "Create task";

  const [projectForm] = Form.useForm<CreateProjectValues>();
  const [taskForm] = Form.useForm<CreateTaskValues>();
  const projectFastMode = Form.useWatch("fastMode", projectForm);
  const projectLocalTunnelEnabled = Form.useWatch("enableLocalTunnel", projectForm);
  const taskFastMode = Form.useWatch("fastMode", taskForm);
  const reasoningOptions: Array<{ label: string; value: NonNullable<CreateTaskValues["reasoningEffort"]> }> = [
    { label: locale === "zh-CN" ? "normal" : "normal", value: "medium" },
    { label: locale === "zh-CN" ? "high（默认）" : "high (default)", value: "high" },
    { label: locale === "zh-CN" ? "xhigh" : "xhigh", value: "xhigh" },
  ];
  const modelOptions = TASK_MODEL_OPTIONS.map((option) => ({ ...option }));

  return (
    <Modal
      open
      title={title}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      closeIcon={<span aria-label={closeLabel}>×</span>}
    >
      {mode === "project" ? (
        <Form
          form={projectForm}
          layout="vertical"
          initialValues={{ visibility: "public", autoCreateRepo: false, enableLocalTunnel: false, model: DEFAULT_TASK_MODEL, reasoningEffort: "high", fastMode: false }}
          onFinish={(values) => void onCreateProject(values)}
        >
          <Form.Item
            name="name"
            label={locale === "zh-CN" ? "项目名称" : "Project name"}
            rules={[{ required: true, message: locale === "zh-CN" ? "请输入项目名称" : "Project name is required" }]}
          >
            <Input placeholder={locale === "zh-CN" ? "项目名称" : "Project name"} />
          </Form.Item>
          <Form.Item
            name="description"
            label={locale === "zh-CN" ? "需求说明" : "Request details"}
            extra={locale === "zh-CN"
              ? "这里填写创建需求；项目卡片中的简介会自动提炼为简短描述。"
              : "Use this for the project request details. Project cards will show a shorter summary automatically."}
          >
            <Input.TextArea
              rows={4}
              placeholder={locale === "zh-CN" ? "目标 / 范围 / 备注" : "Goal / scope / notes"}
            />
          </Form.Item>
          <Form.Item name="repository" label="GitHub URL">
            <Input placeholder="https://github.com/owner/repo" />
          </Form.Item>
          <Form.Item name="visibility" label={locale === "zh-CN" ? "仓库可见性" : "Repository visibility"}>
            <Select
              options={[
                { label: locale === "zh-CN" ? "私有仓库" : "Private repo", value: "private" },
                { label: locale === "zh-CN" ? "公开仓库" : "Public repo", value: "public" },
              ]}
            />
          </Form.Item>
          <Form.Item name="autoCreateRepo" valuePropName="checked">
            <Checkbox>{locale === "zh-CN" ? "自动创建 GitHub 仓库" : "Auto-create GitHub repository"}</Checkbox>
          </Form.Item>
          <Form.Item
            name="enableLocalTunnel"
            valuePropName="checked"
            extra={locale === "zh-CN"
              ? "开启后，本机 worker 会自动为这个项目生成 tunnel env、LaunchAgent 和项目映射，预留 /projects/<project-id>/ 路径，并让成功任务默认发布到 ~/codex/runtime/projects/<project-id>。"
              : "When enabled, the local worker auto-generates the tunnel env, LaunchAgent, and project mapping for this project, reserves a /projects/<project-id>/ route, and publishes successful tasks into ~/codex/runtime/projects/<project-id> by default."}
          >
            <Switch checkedChildren="/projects/*" unCheckedChildren="/tools/*" />
          </Form.Item>
          {projectLocalTunnelEnabled ? (
            <>
              <Form.Item
                name="frontendLocalPort"
                label={locale === "zh-CN" ? "前端本机端口" : "Frontend local port"}
                rules={[
                  { required: true, message: locale === "zh-CN" ? "请输入前端本机端口" : "Frontend local port is required" },
                  { pattern: /^\d+$/, message: locale === "zh-CN" ? "端口必须是数字" : "Port must be numeric" },
                ]}
              >
                <Input placeholder={locale === "zh-CN" ? "例如 3000 / 5173" : "For example 3000 or 5173"} />
              </Form.Item>
              <Form.Item
                name="apiLocalPort"
                label={locale === "zh-CN" ? "API 本机端口" : "API local port"}
                rules={[{ pattern: /^\d+$/, message: locale === "zh-CN" ? "端口必须是数字" : "Port must be numeric" }]}
                extra={locale === "zh-CN"
                  ? "可选。填写后中台会一并为 /projects/<project-id>/api/* 预留反向隧道端口。"
                  : "Optional. When provided, the control plane also reserves a reverse-tunnel port for /projects/<project-id>/api/*."}
              >
                <Input placeholder={locale === "zh-CN" ? "例如 4000 / 8000" : "For example 4000 or 8000"} />
              </Form.Item>
              <Form.Item
                name="localProjectPath"
                label={locale === "zh-CN" ? "本机项目目录" : "Local project path"}
                extra={locale === "zh-CN"
                  ? "可选。留空时本机 worker 会按仓库名或项目 ID 自动推断到 ~/codex/projects 下。"
                  : "Optional. When omitted, the local worker infers a path under ~/codex/projects from the repository or project id."}
              >
                <Input placeholder={locale === "zh-CN" ? "/Users/you/codex/projects/my-app" : "/Users/you/codex/projects/my-app"} />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message={locale === "zh-CN" ? "远端映射端口会自动分配" : "Remote tunnel ports are allocated automatically"}
                description={locale === "zh-CN"
                  ? "创建完成后，本机 worker 会自动写入 ~/.config/codex/project-tunnel.<project-id>.env 和对应的 LaunchAgent，并让后续成功任务默认发布到独立 runtime 目录。长跑的前后端服务应指向 ~/codex/runtime/projects/<project-id>，不要直接跑开发目录。"
                  : "After creation, the local worker writes ~/.config/codex/project-tunnel.<project-id>.env and the matching LaunchAgent automatically, and later successful tasks publish into a separate runtime tree. Long-running frontend/backend services should point at ~/codex/runtime/projects/<project-id>, not the editable dev checkout."}
              />
            </>
          ) : null}
          <Typography.Text type="secondary">
            {locale === "zh-CN"
              ? "仓库地址仅用于代码托管或自动化；控制中台默认通过本地 self-hosted 工具入口验收 UI 项目。"
              : "Repository URLs are optional for code hosting or automation; the control center validates UI projects through the local self-hosted tool route by default."}
          </Typography.Text>
          <Form.Item name="model" label="Model">
            <Select options={modelOptions} />
          </Form.Item>
          <Form.Item
            name="fastMode"
            valuePropName="checked"
            extra={projectFastMode
              ? locale === "zh-CN"
                ? `开启后按 Codex CLI /fast 提交，实际执行 model 为 ${FAST_TASK_MODEL}。`
                : `When enabled, this matches Codex CLI /fast and runs with ${FAST_TASK_MODEL}.`
              : locale === "zh-CN"
                ? "开启后等同于 Codex CLI 内打开 /fast。"
                : "Enable this to match Codex CLI /fast."}
          >
            <Checkbox>{locale === "zh-CN" ? "Fast 模式" : "Fast mode"}</Checkbox>
          </Form.Item>
          <Form.Item
            name="reasoningEffort"
            label={locale === "zh-CN" ? "Reasoning Level" : "Reasoning Level"}
          >
            <Select options={reasoningOptions} />
          </Form.Item>
          <Flex justify="flex-end" gap={8}>
            <Button onClick={onClose}>{closeLabel}</Button>
            <Button type="primary" htmlType="submit">
              {locale === "zh-CN" ? "创建项目" : "Create project"}
            </Button>
          </Flex>
        </Form>
      ) : (
        <Form
          form={taskForm}
          layout="vertical"
          initialValues={{
            projectId: selectedProjectId || projects[0]?.id,
            type: mode === "composite_task" ? "composite_task" : "task",
            model: DEFAULT_TASK_MODEL,
            reasoningEffort: "high",
            planMode: false,
            fastMode: false,
          }}
          onFinish={(values) => void onCreateTask(values)}
        >
          {mode === "task" ? (
            <Form.Item name="projectId" label={locale === "zh-CN" ? "项目" : "Project"}>
              <Select
                options={projects.map((project) => ({
                  label: getProjectDisplayName(project.id, locale, project.name),
                  value: project.id,
                }))}
              />
            </Form.Item>
          ) : (
            <Alert
              type="info"
              showIcon
              message={
                locale === "zh-CN"
                  ? "该任务不预先绑定项目，由 AI 判断归属或是否需要拆分。"
                  : "This task is not pre-bound to a project. AI will route or split it."
              }
            />
          )}
          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="title"
            label={locale === "zh-CN" ? "任务标题" : "Task title"}
            rules={[{ required: true, message: locale === "zh-CN" ? "请输入任务标题" : "Task title is required" }]}
          >
            <Input placeholder={locale === "zh-CN" ? "任务标题" : "Task title"} />
          </Form.Item>
          <Form.Item
            name="description"
            label={locale === "zh-CN" ? "任务描述" : "Task description"}
            rules={[{ required: true, message: locale === "zh-CN" ? "请输入任务描述" : "Task description is required" }]}
          >
            <Input.TextArea rows={5} placeholder={locale === "zh-CN" ? "希望 Codex 完成什么" : "What should Codex do?"} />
          </Form.Item>
          {mode === "task" ? (
            <Form.Item name="planMode" valuePropName="checked">
              <Checkbox>
                {locale === "zh-CN"
                  ? "Plan 模式：先返回计划和待确认项，确认无误后再开始执行"
                  : "Plan mode: draft the plan and open questions before execution starts"}
              </Checkbox>
            </Form.Item>
          ) : null}
          <Form.Item name="model" label="Model">
            <Select options={modelOptions} />
          </Form.Item>
          <Form.Item
            name="fastMode"
            valuePropName="checked"
            extra={taskFastMode
              ? locale === "zh-CN"
                ? `开启后按 Codex CLI /fast 提交，实际执行 model 为 ${FAST_TASK_MODEL}。`
                : `When enabled, this matches Codex CLI /fast and runs with ${FAST_TASK_MODEL}.`
              : locale === "zh-CN"
                ? "开启后等同于 Codex CLI 内打开 /fast。"
                : "Enable this to match Codex CLI /fast."}
          >
            <Checkbox>{locale === "zh-CN" ? "Fast 模式" : "Fast mode"}</Checkbox>
          </Form.Item>
          <Form.Item
            name="reasoningEffort"
            label={locale === "zh-CN" ? "Reasoning Level" : "Reasoning Level"}
          >
            <Select options={reasoningOptions} />
          </Form.Item>
          <Flex justify="flex-end" gap={8}>
            <Button onClick={onClose}>{closeLabel}</Button>
            <Button type="primary" htmlType="submit">
              {locale === "zh-CN" ? "创建任务" : "Create task"}
            </Button>
          </Flex>
        </Form>
      )}
    </Modal>
  );
}

export function StatusFilterBar({
  locale,
  value,
  onChange,
  statusFilterAll,
  statusLabel,
}: StatusFilterBarProps) {
  return (
    <div className="status-filter">
      <Select
        value={value}
        onChange={(next) => onChange(next as StatusFilterValue)}
        options={[
          { label: locale === "zh-CN" ? "全部状态" : "All statuses", value: statusFilterAll },
          ...TASK_STATUS_ORDER.map((status) => ({
            label: statusLabel[status][locale],
            value: status,
          })),
        ]}
        className="status-filter-select"
      />
    </div>
  );
}

export function TaskDetail({
  requirement,
  task,
  locale,
  detailLoading,
  detailError,
  logsLoading,
  logsError,
  onMutate,
  onRespond,
  anomalies,
  dismissedAnomalyIds,
  onDismissAnomaly,
  statusLabel,
  statusTagColor,
  getProjectDisplayName,
  normalizeDisplayText,
  buildLogViews,
}: TaskDetailProps) {
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activeLogTrack, setActiveLogTrack] = useState<LogTrack>("operator");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [acceptanceRejectModalOpen, setAcceptanceRejectModalOpen] = useState(false);
  const [acceptanceRejectFeedback, setAcceptanceRejectFeedback] = useState("");
  const [planResponseForm] = Form.useForm<Record<string, string | string[]>>();
  const logViews = buildLogViews(task.logs);
  const previewLogs = logViews.preview;
  const modalLogs = activeLogTrack === "operator" ? (logViews.operator.length ? logViews.operator : logViews.raw) : logViews.raw;
  const executionDecisionGate = task.executionDecisionGate;
  const pendingReason = getTaskPendingReason(task);
  const supportsUserDecision = task.status === "waiting" && pendingReason === "user_decision";
  const supportsPlanFeedback = task.status === "waiting" && pendingReason === "plan_feedback";
  const supportsManualIntervention = task.status === "waiting" && pendingReason === "manual_intervention";
  const canContinueTask = Boolean(task.allowedActions?.includes("continue"));
  const canBypassGlobalVerification = Boolean(task.allowedActions?.includes("bypass_global_verification"));
  const planQuestions = supportsUserDecision
    ? (executionDecisionGate?.form?.questions || task.planForm?.questions || [])
    : (task.planForm?.questions || []);
  const planResponseValues = Form.useWatch([], planResponseForm) as Record<string, string | string[] | undefined> | undefined;
  const hasOpenPlanQuestions = Boolean(planQuestions.length);
  const isTaskActionPending = Boolean(task.pendingAction?.blocksActions);
  const isPlanDraftPending = Boolean(task.planDraftPending || task.pendingAction?.type === "feedback");
  const isPlanSectionBusy = Boolean(task.status === "waiting" && task.pendingAction?.blocksActions);
  const isApprovalActionPending = task.pendingAction?.type === "approve" || task.pendingAction?.type === "reject";
  const isRetryPending = task.pendingAction?.type === "retry";
  const isGateBypassPending = task.pendingAction?.type === "bypass_global_verification";
  const isCancelPending = task.pendingAction?.type === "cancel";
  const isAcceptanceRejectPending = task.pendingAction?.type === "reject";
  const trimmedAcceptanceRejectFeedback = acceptanceRejectFeedback.trim();
  const failureDiagnosis = getTaskFailureDiagnosis(task, locale);
  const canTaskBeCancelled = canCancelTask(task);
  const cancelLockedAfterPublish = isPublishedTaskCancellationLocked(task);
  const showPublishedCancelGuidance = cancelLockedAfterPublish && !isArchivedTask(task);
  const currentProjectStep = task.projectExecution?.steps?.find((step) => step.id === task.projectExecution?.currentStepId) || null;
  const hasDraftPlanResponse = Boolean(
    planResponseValues
    && Object.entries(planResponseValues).some(([field, value]) => {
      if (field === "__notes") {
        return String(value || "").trim();
      }
      return Array.isArray(value) ? value.length : String(value || "").trim();
    }),
  );
  const canStartExecution = Boolean(task.canStartExecution ?? (!hasOpenPlanQuestions && !hasDraftPlanResponse));

  useEffect(() => {
    planResponseForm.resetFields();
    setLogModalOpen(false);
    setActiveLogTrack(logViews.hasStructuredOperatorLogs ? "operator" : "raw");
    setCancelConfirmOpen(false);
    setAcceptanceRejectModalOpen(false);
    setAcceptanceRejectFeedback("");
  }, [planResponseForm, task.id]);

  function renderPlanQuestionInput(question: PlanQuestion) {
    if (question.kind === "multi_choice" && question.options?.length) {
      return <Checkbox.Group options={question.options.map((option) => ({ label: option, value: option }))} />;
    }
    if (question.kind === "single_choice" && question.options?.length) {
      return (
        <Radio.Group className="full-width">
          <Space direction="vertical" size={8}>
            {question.options.map((option) => (
              <Radio key={option} value={option}>
                {option}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      );
    }
    return (
      <Input.TextArea
        rows={4}
        placeholder={
          question.placeholder
          || (locale === "zh-CN" ? "请补充你的选择或约束" : "Add your choice or constraints")
        }
      />
    );
  }

  function formatPlanResponseValue(question: PlanQuestion, value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(locale === "zh-CN" ? "、" : ", ");
    }
    return String(value || "").trim();
  }

  function serializePlanFeedback(planForm: PlanForm | null | undefined, values: Record<string, string | string[] | undefined>) {
    const responseLines = (planForm?.questions || [])
      .map((question) => {
        const response = formatPlanResponseValue(question, values[question.id]);
        if (!response) {
          return null;
        }
        return `${locale === "zh-CN" ? "- 问题" : "- Question"}：${question.prompt}\n${locale === "zh-CN" ? "  回复" : "  Answer"}：${response}`;
      })
      .filter((item): item is string => Boolean(item));
    const notes = String(values.__notes || "").trim();
    return [
      locale === "zh-CN" ? "本轮计划反馈" : "Plan feedback",
      ...responseLines,
      ...(notes
        ? [
            "",
            locale === "zh-CN" ? "补充说明" : "Additional notes",
            notes,
          ]
        : []),
    ].join("\n");
  }

  function serializeExecutionDecision(values: Record<string, string | string[] | undefined>) {
    const responseLines = planQuestions
      .map((question) => {
        const response = formatPlanResponseValue(question, values[question.id]);
        if (!response) {
          return null;
        }
        return `${locale === "zh-CN" ? "- 决策项" : "- Decision"}：${question.prompt}\n${locale === "zh-CN" ? "  结论" : "  Answer"}：${response}`;
      })
      .filter((item): item is string => Boolean(item));
    const notes = String(values.__notes || "").trim();
    return [
      locale === "zh-CN" ? "项目流决策" : "Project flow decision",
      executionDecisionGate?.title ? `${locale === "zh-CN" ? "当前步骤" : "Current step"}：${executionDecisionGate.title}` : "",
      ...responseLines,
      ...(notes
        ? [
            "",
            locale === "zh-CN" ? "补充说明" : "Additional notes",
            notes,
          ]
        : []),
    ].filter(Boolean).join("\n");
  }

  async function submitPlanFeedback() {
    const questionNames = planQuestions.map((question) => question.id);
    const values = (await planResponseForm.validateFields([...questionNames, "__notes"])) as Record<string, string | string[] | undefined>;
    const serialized = serializePlanFeedback(task.planForm, values).trim();
    if (!serialized || serialized === (locale === "zh-CN" ? "本轮计划反馈" : "Plan feedback")) {
      return;
    }
    const submitted = await onRespond(task.id, "feedback", serialized);
    if (submitted) {
      planResponseForm.resetFields();
    }
  }

  async function submitExecutionDecision() {
    const questionNames = planQuestions.map((question) => question.id);
    const values = (await planResponseForm.validateFields([...questionNames, "__notes"])) as Record<string, string | string[] | undefined>;
    const serialized = serializeExecutionDecision(values).trim();
    if (!serialized || serialized === (locale === "zh-CN" ? "项目流决策" : "Project flow decision")) {
      return;
    }
    const submitted = await onRespond(task.id, "feedback", serialized);
    if (submitted) {
      planResponseForm.resetFields();
    }
  }

  async function submitAcceptanceReject() {
    if (!trimmedAcceptanceRejectFeedback) {
      return;
    }
    const submitted = await onRespond(task.id, "reject", trimmedAcceptanceRejectFeedback);
    if (submitted) {
      setAcceptanceRejectModalOpen(false);
      setAcceptanceRejectFeedback("");
    }
  }

  async function submitCancel() {
    await onMutate(task.id, "cancel");
    setCancelConfirmOpen(false);
  }

  async function submitGateBypass() {
    const defaultReason = locale === "zh-CN"
      ? "当前任务用于修复全局 control-plane 门禁问题，需要在跳过全局门禁的前提下继续执行。"
      : "This task is repairing a global control-plane verification gate and needs to continue with that global gate bypassed.";
    const promptText = locale === "zh-CN"
      ? "请输入门禁豁免原因。该操作只会跳过全局 control-plane 门禁，不会跳过项目校验。"
      : "Enter the gate-bypass reason. This only skips the global control-plane gate and does not skip project checks.";
    const reason = window.prompt(promptText, defaultReason);
    if (reason === null) {
      return;
    }
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return;
    }
    await onMutate(task.id, "bypass_global_verification", normalizedReason);
  }

  return (
    <Space direction="vertical" size={16} className="full-width">
      <Card size="small" className="detail-summary-card">
        <Flex justify="space-between" align="flex-start" gap={16} wrap>
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">
              {getProjectDisplayName(task.projectId, locale, task.projectName)} · {task.type} · requirement #{requirement.latestAttemptNumber}
            </Typography.Text>
            <Typography.Title level={4} className="card-title wrap-anywhere">
              {task.title}
            </Typography.Title>
            <Typography.Text type="secondary">
              {locale === "zh-CN" ? "计划模式：" : "Plan mode: "}
              {task.planMode ? (locale === "zh-CN" ? "是" : "Yes") : (locale === "zh-CN" ? "否" : "No")}
            </Typography.Text>
            <Tag color={getDisplayedStatusColor(task, statusTagColor)}>
              {getDisplayedStatusText(task, locale, statusLabel)}
            </Tag>
          </Space>
          <Flex gap={8} wrap justify="flex-end">
            {supportsManualIntervention && canContinueTask ? (
              <Button type="primary" loading={isRetryPending} disabled={isTaskActionPending} onClick={() => void onMutate(task.id, "retry")}>
                {getRetryActionLabel(task, locale)}
              </Button>
            ) : null}
            {supportsManualIntervention && canBypassGlobalVerification ? (
              <Button loading={isGateBypassPending} disabled={isTaskActionPending} onClick={() => void submitGateBypass()}>
                {locale === "zh-CN" ? "带门禁豁免继续" : "Continue with gate bypass"}
              </Button>
            ) : null}
            {task.status === "awaiting_acceptance" ? (
              <>
                <Button type="primary" loading={task.pendingAction?.type === "approve"} disabled={isTaskActionPending} onClick={() => void onRespond(task.id, "approve", "")}>
                  {locale === "zh-CN" ? "验收通过" : "Accept"}
                </Button>
                <Button
                  loading={isAcceptanceRejectPending}
                  disabled={isTaskActionPending}
                  onClick={() => setAcceptanceRejectModalOpen(true)}
                >
                  {locale === "zh-CN" ? "打回返修" : "Needs revision"}
                </Button>
                {canTaskBeCancelled ? (
                  <Button danger loading={isCancelPending} disabled={isTaskActionPending} onClick={() => setCancelConfirmOpen(true)}>
                    {locale === "zh-CN" ? "取消" : "Cancel"}
                  </Button>
                ) : null}
              </>
            ) : null}
            {(task.status === "pending" || task.status === "running") && canTaskBeCancelled ? (
              <Button danger loading={isCancelPending} disabled={isTaskActionPending} onClick={() => setCancelConfirmOpen(true)}>
                {locale === "zh-CN" ? "取消" : "Cancel"}
              </Button>
            ) : null}
          </Flex>
        </Flex>
      </Card>

      <div className="detail-grid">
        <Card size="small" className="full-width">
          <Typography.Text type="secondary">{locale === "zh-CN" ? "描述" : "Description"}</Typography.Text>
          <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
            {normalizeDisplayText(task.description) || (locale === "zh-CN" ? "暂无描述" : "No description")}
          </Typography.Paragraph>
        </Card>

        {task.pendingAction ? (
          <Alert
            type={task.pendingAction.phase === "timed_out" ? "warning" : "info"}
            showIcon
            message={task.pendingAction.message}
          />
        ) : null}

        {task.executionMode === "orchestrated" && task.projectExecution ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "项目流" : "Project flow"}</Typography.Text>
            <Space direction="vertical" size={10} className="full-width detail-list">
              <Alert
                type={task.status === "waiting" ? "warning" : "info"}
                showIcon
                message={
                  currentProjectStep
                    ? (locale === "zh-CN"
                        ? `当前步骤：${currentProjectStep.title}`
                        : `Current step: ${currentProjectStep.title}`)
                    : (locale === "zh-CN" ? "所有项目步骤已完成" : "All project steps completed")
                }
                description={
                  currentProjectStep
                    ? normalizeDisplayText(currentProjectStep.outcome || "")
                    : normalizeDisplayText(task.userSummary || task.summary || "")
                }
              />
              <List
                size="small"
                dataSource={task.projectExecution.steps}
                renderItem={(step) => {
                  const isCurrent = step.id === task.projectExecution?.currentStepId;
                  const stepTone = step.status === "completed"
                    ? "success"
                    : step.status === "failed"
                      ? "error"
                      : isCurrent
                        ? "processing"
                        : "default";
                  return (
                    <List.Item>
                      <Space direction="vertical" size={4} className="full-width">
                        <Flex justify="space-between" align="flex-start" gap={12}>
                          <Typography.Text strong>{step.title}</Typography.Text>
                          <Tag color={stepTone}>
                            {step.status}
                          </Tag>
                        </Flex>
                        <Typography.Text>{normalizeDisplayText(step.outcome || "")}</Typography.Text>
                        {step.decisionResolved && step.decision ? (
                          <Typography.Text type="secondary">
                            {locale === "zh-CN" ? "已记录决策：" : "Recorded decision: "}
                            {normalizeDisplayText(step.decision)}
                          </Typography.Text>
                        ) : null}
                        {step.lastFailure ? (
                          <Typography.Text type="danger">
                            {locale === "zh-CN" ? "最近失败：" : "Latest failure: "}
                            {normalizeDisplayText(step.lastFailure)}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </Space>
          </Card>
        ) : null}

        {failureDiagnosis ? (
          <Alert
            type={failureDiagnosis.type}
            showIcon
            message={failureDiagnosis.title}
            description={(
              <Space direction="vertical" size={6}>
                <Typography.Text>{failureDiagnosis.summary}</Typography.Text>
                <Typography.Text type="secondary">{failureDiagnosis.timeline}</Typography.Text>
                <Typography.Text>{failureDiagnosis.guidance}</Typography.Text>
                {task.pendingReasonDetail || task.openFailureReason ? (
                  <Typography.Text type="secondary">
                    {failureDiagnosis.rawReasonLabel}：{normalizeDisplayText(task.pendingReasonDetail || task.openFailureReason || "")}
                  </Typography.Text>
                ) : null}
              </Space>
            )}
          />
        ) : null}

        {showPublishedCancelGuidance ? (
          <Alert
            type="info"
            showIcon
            message={
              locale === "zh-CN"
                ? "该任务已发布，不能再取消"
                : "This task has already been published and can no longer be cancelled"
            }
            description={
              locale === "zh-CN"
                ? "当前结果可能已经成为后续任务的开发基线。若结果符合预期，请直接验收；若不符合预期，请打回返修。"
                : "Its result may already be the baseline for later work. Accept it if it is correct, or send it back for revision if it is not."
            }
          />
        ) : null}

        {task.planPreview ? (
          <Card size="small" className="full-width">
            <Spin
              spinning={isPlanDraftPending || isApprovalActionPending}
              tip={
                task.pendingAction?.message
                || (locale === "zh-CN" ? "继续生成下一版计划中" : "Generating the next plan draft")
              }
            >
              <Typography.Text type="secondary">{locale === "zh-CN" ? "计划预览" : "Plan preview"}</Typography.Text>
              <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
                {normalizeDisplayText(task.planPreview)}
              </Typography.Paragraph>
            </Spin>
          </Card>
        ) : null}

        {supportsUserDecision ? (
          <Card size="small" className="full-width">
            <Spin
              spinning={isPlanSectionBusy}
              tip={
                task.pendingAction?.message
                || (locale === "zh-CN" ? "系统正在处理你的反馈" : "The system is processing your feedback")
              }
            >
              <Typography.Text type="secondary">
                {locale === "zh-CN" ? "用户拍板反馈" : "Decision feedback"}
              </Typography.Text>
              <Typography.Paragraph className="detail-text">
                {normalizeDisplayText(executionDecisionGate?.prompt || task.pendingReasonDetail || task.userAction?.detail || "")}
              </Typography.Paragraph>
              <Alert
                type="warning"
                showIcon
                message={
                  locale === "zh-CN"
                    ? "当前任务需要你补充拍板意见。提交反馈后，系统会根据你的决定继续处理。"
                    : "This task needs your decision input. Submit feedback and the system will continue from there."
                }
                style={{ marginBottom: 12 }}
              />
              <Form form={planResponseForm} layout="vertical" requiredMark={false} disabled={isPlanSectionBusy}>
                {planQuestions.map((question) => (
                  <Form.Item
                    key={question.id}
                    name={question.id}
                    label={question.prompt}
                    extra={question.description || undefined}
                    rules={
                      question.required
                        ? [{
                            required: true,
                            message: locale === "zh-CN" ? "请先补充当前决策" : "Please provide the decision first",
                          }]
                        : undefined
                    }
                  >
                    {renderPlanQuestionInput(question)}
                  </Form.Item>
                ))}
                <Form.Item
                  name="__notes"
                  label={locale === "zh-CN" ? "补充说明" : "Additional notes"}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={
                      locale === "zh-CN"
                        ? "可选：补充约束、优先级或不希望继续做的方向"
                        : "Optional: add constraints, priorities, or directions that should be excluded"
                    }
                  />
                </Form.Item>
              </Form>
              <Flex gap={8} wrap style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  loading={task.pendingAction?.type === "feedback"}
                  onClick={() => void submitExecutionDecision()}
                  disabled={isPlanSectionBusy}
                >
                  {locale === "zh-CN" ? "提交反馈" : "Submit feedback"}
                </Button>
                {canTaskBeCancelled ? (
                  <Button danger loading={isCancelPending} disabled={isPlanSectionBusy} onClick={() => setCancelConfirmOpen(true)}>
                    {locale === "zh-CN" ? "取消" : "Cancel"}
                  </Button>
                ) : null}
              </Flex>
            </Spin>
          </Card>
        ) : null}

        {supportsPlanFeedback ? (
          <Card size="small" className="full-width">
            <Spin
              spinning={isPlanSectionBusy}
              tip={
                task.pendingAction?.message
                || (locale === "zh-CN" ? "系统正在根据最新内容自动生成下一版计划" : "The next plan draft is being generated automatically")
              }
            >
              <Typography.Text type="secondary">
                {task.planForm?.title || (locale === "zh-CN" ? "计划反馈表单" : "Plan response form")}
              </Typography.Text>
              <Typography.Paragraph className="detail-text">
                {task.planForm?.description || (
                  locale === "zh-CN"
                    ? "待确认项请在详情页内回答后继续规划；待确认项清零且你没有新反馈时，再开始执行。"
                    : "Answer open questions here. Start execution only after the plan has no unresolved questions and you have no further edits."
                )}
              </Typography.Paragraph>
              {task.pendingAction ? (
                <Alert
                  type={task.pendingAction.phase === "timed_out" ? "warning" : "info"}
                  showIcon
                  message={task.pendingAction.message}
                  style={{ marginBottom: 12 }}
                />
              ) : isPlanDraftPending ? (
                <Alert
                  type="warning"
                  showIcon
                  message={
                    locale === "zh-CN"
                      ? "系统正在根据最新内容自动生成下一版计划，当前先不要开始执行。"
                      : "The next plan draft is being generated automatically. Do not start execution yet."
                  }
                  style={{ marginBottom: 12 }}
                />
              ) : hasOpenPlanQuestions ? (
                <Alert
                  type="info"
                  showIcon
                  message={locale === "zh-CN" ? "当前计划仍有待确认项，需先提交反馈继续规划。" : "This plan still has open questions. Submit responses before execution can start."}
                  style={{ marginBottom: 12 }}
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  message={locale === "zh-CN" ? "当前计划已没有待确认项，可以开始执行。" : "No open questions remain in the current plan. Execution can start."}
                  style={{ marginBottom: 12 }}
                />
              )}
              <Form form={planResponseForm} layout="vertical" requiredMark={false} disabled={isPlanSectionBusy}>
                {planQuestions.map((question) => (
                  <Form.Item
                    key={question.id}
                    name={question.id}
                    label={question.prompt}
                    extra={question.description || undefined}
                    rules={
                      question.required
                        ? [{
                            required: true,
                            message: locale === "zh-CN" ? "请先完成这个待确认项" : "Please answer this question first",
                          }]
                        : undefined
                    }
                  >
                    {renderPlanQuestionInput(question)}
                  </Form.Item>
                ))}
                <Form.Item
                  name="__notes"
                  label={locale === "zh-CN" ? "补充说明" : "Additional notes"}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={
                      locale === "zh-CN"
                        ? "可选：补充限制条件、优先级或你希望调整的一期范围"
                        : "Optional: add constraints, priorities, or phase-1 adjustments"
                    }
                  />
                </Form.Item>
              </Form>
              {hasDraftPlanResponse && !hasOpenPlanQuestions ? (
                <Typography.Text type="warning">
                  {locale === "zh-CN"
                    ? "当前表单里有未提交的补充说明；如需继续规划，请先提交反馈。"
                    : "There is unsent form content. Submit feedback first if you want another planning round."}
                </Typography.Text>
              ) : null}
              <Flex gap={8} wrap style={{ marginTop: 12 }}>
                <Button
                  loading={task.pendingAction?.type === "feedback"}
                  onClick={() => void submitPlanFeedback()}
                  disabled={isPlanSectionBusy || (!hasOpenPlanQuestions && !hasDraftPlanResponse)}
                >
                  {locale === "zh-CN" ? "提交反馈继续规划" : "Submit feedback"}
                </Button>
                <Button
                  type="primary"
                  loading={task.pendingAction?.type === "approve"}
                  onClick={() => void onRespond(task.id, "approve", "")}
                  disabled={isPlanSectionBusy || !canStartExecution}
                >
                  {locale === "zh-CN" ? "确认计划并开始执行" : "Start execution"}
                </Button>
                {canTaskBeCancelled ? (
                  <Button danger loading={isCancelPending} disabled={isPlanSectionBusy} onClick={() => setCancelConfirmOpen(true)}>
                    {locale === "zh-CN" ? "取消" : "Cancel"}
                  </Button>
                ) : null}
              </Flex>
            </Spin>
          </Card>
        ) : null}

        {supportsManualIntervention ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">
              {locale === "zh-CN" ? "人工介入处理" : "Manual handling"}
            </Typography.Text>
            {task.pendingAction ? (
              <Alert
                type={task.pendingAction.phase === "timed_out" ? "warning" : "info"}
                showIcon
                message={task.pendingAction.message}
                style={{ marginTop: 12 }}
              />
            ) : null}
            <Flex gap={8} wrap style={{ marginTop: 12 }}>
              {canContinueTask ? (
                <Button type="primary" loading={isRetryPending} disabled={isTaskActionPending} onClick={() => void onMutate(task.id, "retry")}>
                  {getRetryActionLabel(task, locale)}
                </Button>
              ) : null}
              {canBypassGlobalVerification ? (
                <Button loading={isGateBypassPending} disabled={isTaskActionPending} onClick={() => void submitGateBypass()}>
                  {locale === "zh-CN" ? "带门禁豁免继续" : "Continue with gate bypass"}
                </Button>
              ) : null}
              {canTaskBeCancelled ? (
                <Button danger loading={isCancelPending} disabled={isTaskActionPending} onClick={() => setCancelConfirmOpen(true)}>
                  {locale === "zh-CN" ? "取消" : "Cancel"}
                </Button>
              ) : null}
            </Flex>
          </Card>
        ) : null}

        {(task.userSummary || task.summary) ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "摘要" : "Summary"}</Typography.Text>
            <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
              {normalizeDisplayText(task.userSummary || task.summary)}
            </Typography.Paragraph>
          </Card>
        ) : null}

        {task.pendingReasonDetail || task.openFailureReason ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">
              {failureDiagnosis?.rawReasonLabel || (locale === "zh-CN" ? "未完成原因" : "Why not completed")}
            </Typography.Text>
            <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
              {normalizeDisplayText(task.pendingReasonDetail || task.openFailureReason || "")}
            </Typography.Paragraph>
          </Card>
        ) : null}

        {detailError ? (
          <Alert
            type="warning"
            showIcon
            message={locale === "zh-CN" ? "任务详情刷新失败" : "Task detail refresh failed"}
            description={locale === "zh-CN"
              ? `当前仍展示列表里的基础信息；详情字段可能不是最新。${detailError}`
              : `The view is still showing summary data from the task list, but detail-only fields may be stale. ${detailError}`}
          />
        ) : null}

        {anomalies.length ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "当前异常闭环" : "Current anomaly handling"}</Typography.Text>
            <Space direction="vertical" size={12} className="full-width detail-list">
              {anomalies.map((anomaly) => {
                const isDismissed = dismissedAnomalyIds.has(anomaly.id);
                return (
                  <Alert
                    key={anomaly.id}
                    type={anomaly.status === "waiting" ? "warning" : "info"}
                    showIcon
                    message={statusLabel[anomaly.status][locale]}
                    description={
                      <Space direction="vertical" size={8}>
                        <Typography.Text>{normalizeDisplayText(anomaly.detail)}</Typography.Text>
                        {isDismissed ? null : (
                          <Button onClick={() => onDismissAnomaly(anomaly)}>
                            {locale === "zh-CN" ? "标记已处理" : "Mark handled"}
                          </Button>
                        )}
                      </Space>
                    }
                  />
                );
              })}
            </Space>
          </Card>
        ) : null}

        {task.acceptanceCriteria?.length ? (
          <Card size="small">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "验收清单" : "Acceptance checklist"}</Typography.Text>
            <Spin spinning={detailLoading}>
              <List
                className="detail-list"
                dataSource={task.acceptanceCriteria}
                renderItem={(criterion) => {
                  const verification = task.verificationResults?.find((item) => item.criterionId === criterion.id);
                  return (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Typography.Text strong>{criterion.text}</Typography.Text>
                        <Typography.Text type="secondary">
                          {(verification?.status || "pending")}{verification?.evidence ? ` · ${verification.evidence}` : ""}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </Spin>
          </Card>
        ) : detailLoading ? (
          <Card size="small">
            <Spin spinning>
              <Typography.Text type="secondary">
                {locale === "zh-CN" ? "正在加载验收清单…" : "Loading acceptance checklist..."}
              </Typography.Text>
            </Spin>
          </Card>
        ) : null}

        {requirement.attempts.length > 1 ? (
          <Card size="small">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "尝试历史" : "Attempt history"}</Typography.Text>
            <List
              className="detail-list"
              dataSource={requirement.attempts}
              renderItem={(attempt) => (
                <List.Item>
                  <Space direction="vertical" size={4}>
                    <Space>
                      <Typography.Text strong>#{attempt.attemptNumber || "?"}</Typography.Text>
                      <Tag color={getDisplayedStatusColor(attempt, statusTagColor)}>{getDisplayedStatusText(attempt, locale, statusLabel)}</Tag>
                    </Space>
                    <Typography.Text>
                      {normalizeDisplayText(attempt.userSummary || attempt.summary || attempt.openFailureReason || attempt.description)}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        ) : null}

        <Card size="small">
          <Descriptions
            column={1}
            items={[
              task.branchName ? { key: "branch", label: locale === "zh-CN" ? "分支" : "Branch", children: <span className="wrap-anywhere">{task.branchName}</span> } : null,
              task.workspacePath ? { key: "workspace", label: locale === "zh-CN" ? "工作区" : "Workspace", children: <span className="wrap-anywhere">{task.workspacePath}</span> } : null,
              task.children.length
                ? {
                    key: "children",
                    label: locale === "zh-CN" ? "子任务" : "Child tasks",
                    children: (
                      <span className="preserve-breaks wrap-anywhere">
                        {task.children.map((child) => `${child.title} (${statusLabel[child.status][locale]})`).join("\n")}
                      </span>
                    ),
                  }
                : null,
            ].filter(Boolean) as Array<{ key: string; label: string; children: ReactNode }>}
          />
        </Card>
      </div>

      <Card size="small">
        <SectionHeader
          title={locale === "zh-CN" ? "任务日志" : "Task logs"}
          actions={
            task.logs.length ? (
              <Button onClick={() => setLogModalOpen(true)}>
                {locale === "zh-CN" ? "查看全部日志" : "View all logs"}
              </Button>
            ) : undefined
          }
        />
        <Spin spinning={logsLoading}>
          {logsError ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={locale === "zh-CN" ? "任务日志刷新失败" : "Task log refresh failed"}
              description={logsError}
            />
          ) : null}
          {previewLogs.length ? (
            <Space direction="vertical" size={12} className="full-width">
              <Typography.Text type="secondary">
                {getLogSummaryText(logViews, locale)}
              </Typography.Text>
              <List
                className="detail-list"
                dataSource={previewLogs}
                renderItem={(entry) => (
                  <List.Item key={`${entry.timestamp}-${entry.message}`}>
                    <Space direction="vertical" size={4} className="full-width task-log-entry">
                      <Typography.Text type="secondary">
                        {new Date(entry.timestamp).toLocaleString(locale)}
                      </Typography.Text>
                      <Typography.Text className="wrap-anywhere preserve-breaks task-log-preview-message">
                        {normalizeDisplayText(entry.message)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
              {logViews.hasOverflow ? (
                <Typography.Text type="secondary">
                  {locale === "zh-CN"
                    ? `还有 ${logViews.hiddenCount} 条未展开日志，点击“查看全部日志”浏览完整记录。`
                    : `${logViews.hiddenCount} more log entries are hidden from the preview. Open the full log view to inspect them.`}
                </Typography.Text>
              ) : null}
            </Space>
          ) : logsLoading ? null : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无日志" : "No logs yet"} />
          )}
        </Spin>
      </Card>

      <Modal
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={null}
        width={880}
        title={locale === "zh-CN" ? "任务日志" : "Task logs"}
      >
        <Space direction="vertical" size={16} className="full-width">
          {logsError ? (
            <Alert
              type="warning"
              showIcon
              message={locale === "zh-CN" ? "任务日志刷新失败" : "Task log refresh failed"}
              description={logsError}
            />
          ) : null}
          {logViews.hasStructuredOperatorLogs ? (
            <Segmented<LogTrack>
              block
              value={activeLogTrack}
              onChange={(value) => setActiveLogTrack(value)}
              options={[
                { label: `${getLogTrackLabel("operator", locale)} (${logViews.operator.length})`, value: "operator" },
                { label: `${getLogTrackLabel("raw", locale)} (${logViews.raw.length})`, value: "raw" },
              ]}
            />
          ) : null}
          <Typography.Text type="secondary">
            {getLogSummaryText(logViews, locale)}
          </Typography.Text>
          {modalLogs.length ? (
            <div className="task-log-modal-body">
              <List
                className="detail-list"
                dataSource={modalLogs}
                renderItem={(entry) => (
                  <List.Item key={`${entry.timestamp}-${entry.message}`}>
                    <Space direction="vertical" size={4} className="full-width task-log-entry">
                      <Typography.Text type="secondary">
                        {new Date(entry.timestamp).toLocaleString(locale)}
                      </Typography.Text>
                      <Typography.Text className="wrap-anywhere preserve-breaks task-log-full-message">
                        {normalizeDisplayText(entry.message)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          ) : logsLoading ? (
            <Spin spinning />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无日志" : "No logs yet"} />
          )}
        </Space>
      </Modal>

      <Modal
        open={cancelConfirmOpen}
        title={locale === "zh-CN" ? "确认取消任务" : "Confirm cancellation"}
        onCancel={() => {
          if (!isCancelPending) {
            setCancelConfirmOpen(false);
          }
        }}
        footer={[
          <Button key="keep" onClick={() => setCancelConfirmOpen(false)} disabled={Boolean(isCancelPending)}>
            {locale === "zh-CN" ? "继续保留任务" : "Keep task"}
          </Button>,
          <Button key="cancel" danger type="primary" loading={Boolean(isCancelPending)} onClick={() => void submitCancel()}>
            {locale === "zh-CN" ? "确认取消" : "Confirm cancel"}
          </Button>,
        ]}
        maskClosable={!isCancelPending}
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="warning"
            showIcon
            message={
              locale === "zh-CN"
                ? "取消只会清理当前未发布任务的工作区和中间痕迹，不会回退已经发布的版本。"
                : "Cancellation only cleans up workspace artifacts for unpublished tasks. It does not roll back an already published release."
            }
            description={
              locale === "zh-CN"
                ? "确认后请不要重复点击；如果后台清理变慢，详情页会持续显示处理中。"
                : "Do not click again after confirming. If cleanup is slow, the detail view will keep showing the in-progress state."
            }
          />
          <Typography.Text>
            {locale === "zh-CN"
              ? "只有“成功”和“已取消”会被视为归档态。"
              : "Only succeeded and cancelled tasks are treated as archived."}
          </Typography.Text>
        </Space>
      </Modal>

      <Modal
        open={acceptanceRejectModalOpen}
        title={locale === "zh-CN" ? "填写返修反馈" : "Provide revision feedback"}
        onCancel={() => {
          if (!isAcceptanceRejectPending) {
            setAcceptanceRejectModalOpen(false);
            setAcceptanceRejectFeedback("");
          }
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAcceptanceRejectModalOpen(false);
              setAcceptanceRejectFeedback("");
            }}
            disabled={Boolean(isAcceptanceRejectPending)}
          >
            {locale === "zh-CN" ? "取消" : "Cancel"}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={Boolean(isAcceptanceRejectPending)}
            disabled={!trimmedAcceptanceRejectFeedback}
            onClick={() => void submitAcceptanceReject()}
          >
            {locale === "zh-CN" ? "提交返修" : "Send back for revision"}
          </Button>,
        ]}
        maskClosable={!isAcceptanceRejectPending}
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="warning"
            showIcon
            message={
              locale === "zh-CN"
                ? "请明确说明为什么当前交付不能验收，以及本轮优先要修什么。"
                : "Explain why the current delivery cannot be accepted and what should be fixed first."
            }
            description={
              task.executionMode === "orchestrated"
                ? (locale === "zh-CN"
                    ? "提交后项目流会直接进入返修步骤，不会停在待返修等你再次确认。"
                    : "Submitting this will queue a revision step immediately so the project flow can continue.")
                : (locale === "zh-CN"
                    ? "提交后系统会直接开始下一次处理；如果仍有需要你补充的信息，会再回到“待处理”。"
                    : "Submitting this will start the next handling round immediately. If more input is needed, the task will return to pending handling.")
            }
          />
          <Input.TextArea
            rows={6}
            value={acceptanceRejectFeedback}
            onChange={(event) => setAcceptanceRejectFeedback(event.target.value)}
            placeholder={
              locale === "zh-CN"
                ? "例如：页面虽已部署，但核心使用链路不可用；请先补齐可实际操作的最小闭环，并附操作说明。"
                : "Example: The page is deployed, but the core usage flow is still broken. Please fix the minimum usable flow and include validation steps."
            }
          />
          <Typography.Text type="secondary">
            {locale === "zh-CN"
              ? "返修反馈会直接作为任务的未完成原因保留下来。"
              : "The feedback will be stored as the task's open failure reason."}
          </Typography.Text>
        </Space>
      </Modal>
    </Space>
  );
}

export function ApprovalCard({
  approval,
  locale,
  onOpenTask,
  statusLabel,
  statusTagColor,
  getProjectDisplayName,
}: ApprovalCardProps) {
  return (
    <Card size="small" className="list-card">
      <Space direction="vertical" size={10} className="full-width">
        <Typography.Text strong className="wrap-anywhere">
          {approval.task.title}
        </Typography.Text>
        <Typography.Text type="secondary" className="wrap-anywhere">
          {approval.task.userAction?.title || approval.reason}
        </Typography.Text>
        <Typography.Text type="secondary" className="wrap-anywhere">
          {approval.task.pendingAction?.message
            ? approval.task.pendingAction.message
            : getTaskPendingReason(approval.task) === "user_decision"
            ? (
                locale === "zh-CN"
                  ? "当前任务需要你在详情页补充拍板意见后继续。"
                  : "This task needs your decision input in the detail view."
              )
            : getTaskPendingReason(approval.task) === "plan_feedback" && approval.task.planDraftPending
            ? (
                locale === "zh-CN"
                  ? "计划正在自动生成或更新，请点击详情查看最新版本。"
                  : "The plan is being generated or refreshed automatically. Open the detail view for the latest draft."
              )
            : getTaskPendingReason(approval.task) === "plan_feedback" && approval.task.planForm?.questions?.length
            ? (
                locale === "zh-CN"
                  ? `有 ${approval.task.planForm.questions.length} 个待确认项，请在详情页完成回复。`
                  : `${approval.task.planForm.questions.length} open questions need responses in the detail view.`
              )
            : getTaskPendingReason(approval.task) === "manual_intervention"
            ? (
                canCancelTask(approval.task)
                  ? (
                      locale === "zh-CN"
                        ? "当前任务处于系统跟进状态，请在详情页查看当前处理结果；只有确实需要你的判断时才会单独提示。"
                        : "This task is under system follow-up. Open the detail view to inspect the current state; you will only be asked for input when a real decision is needed."
                    )
                  : (
                      locale === "zh-CN"
                        ? "当前任务处于系统跟进状态，请在详情页查看最新结果；若发布结果不符合预期，请直接打回返修。"
                        : "This task is under system follow-up. Open the detail view for the latest result; if the published output is wrong, send it back for revision."
                    )
              )
            : (
                locale === "zh-CN"
                  ? "请在详情页查看当前处理状态。"
                  : "Open the detail view for the current task state."
              )}
        </Typography.Text>
        <Space wrap>
          <Tag color={getDisplayedStatusColor(approval.task, statusTagColor)}>
            {getDisplayedStatusText(approval.task, locale, statusLabel)}
          </Tag>
          <Typography.Text type="secondary">
            {getProjectDisplayName(approval.task.projectId, locale, approval.task.projectName)} · {approval.task.type}
          </Typography.Text>
        </Space>
        <Alert
          type={approval.task.pendingAction ? (approval.task.pendingAction.phase === "timed_out" ? "warning" : "info") : "warning"}
          showIcon
          message={
            approval.task.pendingAction?.message
            || (locale === "zh-CN"
              ? "请在详情页查看当前待处理状态。"
              : "Open the detail view for the current pending state.")
          }
        />
        <Flex gap={8} wrap>
          <Button onClick={() => onOpenTask(approval.task.id)}>
            {locale === "zh-CN" ? "去详情处理" : "Open detail"}
          </Button>
        </Flex>
      </Space>
    </Card>
  );
}

export function HeaderSwitch({ checked, label, checkedChildren, unCheckedChildren, onToggle }: HeaderSwitchProps) {
  return (
    <Flex align="center" gap={8} className="header-switch-card">
      <Typography.Text>{label}</Typography.Text>
      <Switch
        checked={checked}
        checkedChildren={<span className="header-switch-icon">{checkedChildren || <MoonOutlined />}</span>}
        unCheckedChildren={<span className="header-switch-icon">{unCheckedChildren || <SunOutlined />}</span>}
        aria-label={label}
        onChange={onToggle}
      />
    </Flex>
  );
}

export function HeaderLocaleSwitch({ label, value, onChange }: HeaderLocaleSwitchProps) {
  return (
    <Flex align="center" gap={8} className="header-switch-card">
      <Typography.Text>{label}</Typography.Text>
      <Segmented
        value={value}
        onChange={(next) => onChange(next as Locale)}
        options={[
          { label: "中文", value: "zh-CN", icon: <GlobalOutlined /> },
          { label: "English", value: "en-US", icon: <GlobalOutlined /> },
        ]}
      />
    </Flex>
  );
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <Flex justify="space-between" align="flex-start" gap={16} wrap className="section-header">
      <Space direction="vertical" size={4}>
        <Typography.Title level={4} className="section-title">
          {title}
        </Typography.Title>
        {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      </Space>
      {actions ? <div>{actions}</div> : null}
    </Flex>
  );
}

export function ListPagination({
  locale,
  current,
  pageSize,
  total,
  itemLabel,
  onChange,
}: ListPaginationProps) {
  if (total <= pageSize) {
    return null;
  }

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  return (
    <Flex justify="space-between" align="center" gap={12} wrap className="list-pagination">
      <Typography.Text type="secondary">
        {locale === "zh-CN"
          ? `第 ${start}-${end} 条，共 ${total} 条${itemLabel[locale]}`
          : `${start}-${end} of ${total} ${itemLabel[locale]}`}
      </Typography.Text>
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        showSizeChanger={false}
        responsive
        onChange={onChange}
      />
    </Flex>
  );
}

export function MetricCard({
  subtitle,
  title,
  value,
  badge,
  extra,
  className,
  valueTone = "hero",
}: MetricCardProps) {
  const cardClassName = ["metric-card", className].filter(Boolean).join(" ");

  return (
    <Card size="small" className={cardClassName}>
      <Space direction="vertical" size={valueTone === "hero" ? 12 : 10} className="full-width">
        <Flex justify="space-between" align="flex-start" gap={12}>
          <Space direction="vertical" size={2}>
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
            {title ? (
              <Typography.Title level={5} className="metric-title">
                {title}
              </Typography.Title>
            ) : null}
          </Space>
          {badge ? <Tag>{badge}</Tag> : null}
        </Flex>
        {valueTone === "body" ? (
          <Typography.Paragraph className="metric-value metric-value-body wrap-anywhere">
            {value}
          </Typography.Paragraph>
        ) : (
          <Typography.Title
            level={valueTone === "hero" ? 2 : 4}
            className={`metric-value metric-value-${valueTone} wrap-anywhere`}
          >
            {value}
          </Typography.Title>
        )}
        {extra ? <div>{extra}</div> : null}
      </Space>
    </Card>
  );
}
