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

import { getLogSummaryText, getLogTrackLabel, type LogTrack, type LogViews } from "./dashboardLogs";
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
  onMutate: (taskId: string, action: "stop" | "retry") => Promise<void>;
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
  if (task.executionDecisionGate && task.status === "waiting_user") {
    return locale === "zh-CN" ? "待你决策" : "Decision needed";
  }
  if (task.pendingAction?.label) {
    return task.pendingAction.label;
  }
  if (task.planDraftPending && task.status === "waiting_user") {
    return locale === "zh-CN" ? "继续规划中" : "Planning";
  }
  return statusLabel[task.status][locale];
}

function getDisplayedStatusColor(task: Task, statusTagColor: StatusTagColorMap) {
  if (task.pendingAction) {
    return task.pendingAction.phase === "timed_out" ? "warning" : "processing";
  }
  if (task.planDraftPending && task.status === "waiting_user") {
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
  const reason = String(task.openFailureReason || task.summary || "").trim();
  const hasFailureStatus = ["failed", "stopped", "needs_revision", "publish_failed"].includes(task.status);
  if (!reason && !hasFailureStatus) {
    return null;
  }

  if (task.executionMode === "orchestrated" && hasFailureStatus && task.failureType === "step_failed") {
    const currentStep = task.projectExecution?.steps?.find((step) => step.id === task.projectExecution?.currentStepId);
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "项目流在当前步骤失败，支持从当前步骤恢复"
        : "The project flow failed on the current step and can resume from there",
      summary: locale === "zh-CN"
        ? `当前失败发生在步骤「${currentStep?.title || task.failurePhase || "未知步骤"}」。重试不会重新走审批，会直接从这一步继续。`
        : `The failure happened on "${currentStep?.title || task.failurePhase || "the current step"}". Retrying resumes from this step instead of restarting planning.`,
      timeline: locale === "zh-CN"
        ? `最近失败记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest failure record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "先看下面的失败原因；如果方向没问题，直接点“恢复执行”即可。"
        : "Read the failure reason below first. If the direction is still correct, use Resume to continue.",
      rawReasonLabel: locale === "zh-CN" ? "失败原因" : "Failure reason",
    };
  }

  if (task.executionMode === "orchestrated" && hasFailureStatus && task.failureType === "stalled_project_flow") {
    return {
      type: "warning" as const,
      title: locale === "zh-CN"
        ? "项目流失去了活动步骤，已暂停"
        : "The project flow lost its active step and paused",
      summary: locale === "zh-CN"
        ? "系统没有检测到当前应该继续执行的项目步骤，所以先把项目流暂停了。"
        : "The system could not find an active step to continue, so it paused the project flow.",
      timeline: locale === "zh-CN"
        ? `最近暂停记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest pause record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "直接点“恢复执行”即可按保留的项目流状态继续。"
        : "Use Resume to continue from the preserved project-flow state.",
      rawReasonLabel: locale === "zh-CN" ? "暂停原因" : "Pause reason",
    };
  }

  if (task.status === "failed" && /prolonged inactivity without a final summary/i.test(reason)) {
    const runningAt = findStatusTimestamp(task, "running");
    const failedAt = findStatusTimestamp(task, "failed") || task.updatedAt || "";
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "执行阶段长时间无进展，系统已自动判失败"
        : "Execution stalled and was auto-failed",
      summary: locale === "zh-CN"
        ? "任务进入运行后，长时间没有新的进度更新，也没有写出最终总结。控制服务的恢复监控随后把它标记为失败。"
        : "After the task entered running, it stopped producing progress updates and never wrote a final summary. The control server's recovery monitor then marked it as failed.",
      timeline: locale === "zh-CN"
        ? `进入运行：${formatTaskTimestamp(runningAt, locale)}；标记失败：${formatTaskTimestamp(failedAt, locale)}`
        : `Entered running: ${formatTaskTimestamp(runningAt, locale)}; marked failed: ${formatTaskTimestamp(failedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "建议先点“重试”。如果再次出现，说明 worker 在启动后卡住了，需要排查模型调用、网络访问或外部命令阻塞。"
        : "Retry once first. If it happens again, the worker is likely stalling after startup and the backend execution environment, network access, or external commands need investigation.",
      rawReasonLabel: locale === "zh-CN" ? "原始原因" : "Raw reason",
    };
  }

  if (task.status === "publish_failed") {
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "实现已完成，但发布或同步失败"
        : "Implementation finished, but publish or sync failed",
      summary: locale === "zh-CN"
        ? "代码产物已经跑出来了，但发布到目标仓库或同步基线没有成功。"
        : "The implementation completed, but publishing to the target repo or syncing the baseline did not succeed.",
      timeline: locale === "zh-CN"
        ? `最近失败记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest failure record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "先看原始错误，再决定是直接重试，还是先修复仓库权限、分支冲突或发布配置。"
        : "Read the raw error first, then decide whether to retry immediately or fix repo permissions, branch conflicts, or publish configuration.",
      rawReasonLabel: locale === "zh-CN" ? "原始原因" : "Raw reason",
    };
  }

  if (task.status === "needs_revision") {
    return {
      type: "warning" as const,
      title: locale === "zh-CN"
        ? "当前结果仍需返修"
        : "This result still needs revision",
      summary: locale === "zh-CN"
        ? "任务执行到了结果阶段，但当前产物没有通过完成条件。"
        : "The task reached a result state, but the current output did not pass the completion criteria.",
      timeline: locale === "zh-CN"
        ? `最近返修记录：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Latest revision record: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "根据下面的原因修改后，再点“重试”继续。"
        : "Fix the issues described below, then retry the task.",
      rawReasonLabel: locale === "zh-CN" ? "当前原因" : "Current reason",
    };
  }

  if (task.status === "stopped") {
    return {
      type: "warning" as const,
      title: locale === "zh-CN"
        ? "任务已被停止"
        : "The task was stopped",
      summary: locale === "zh-CN"
        ? "任务在完成前被手动或信号停止了。"
        : "The task was stopped before it could finish.",
      timeline: locale === "zh-CN"
        ? `停止时间：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Stopped at: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "如果仍需要继续，可以点“重试”重新排队。"
        : "If work should continue, retry the task to queue it again.",
      rawReasonLabel: locale === "zh-CN" ? "停止说明" : "Stop detail",
    };
  }

  if (task.status === "failed") {
    return {
      type: "error" as const,
      title: locale === "zh-CN"
        ? "任务执行失败"
        : "Task execution failed",
      summary: locale === "zh-CN"
        ? "任务在执行过程中失败了，下面是系统记录到的直接原因。"
        : "The task failed during execution. The direct reason recorded by the system is shown below.",
      timeline: locale === "zh-CN"
        ? `失败时间：${formatTaskTimestamp(task.updatedAt, locale)}`
        : `Failed at: ${formatTaskTimestamp(task.updatedAt, locale)}`,
      guidance: locale === "zh-CN"
        ? "先看原始原因，再决定是否直接重试；如果重复失败，需要排查后端执行环境。"
        : "Read the raw reason first, then decide whether to retry immediately. If it fails again, investigate the backend execution environment.",
      rawReasonLabel: locale === "zh-CN" ? "原始原因" : "Raw reason",
    };
  }

  return null;
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
  const reasoningOptions: Array<{ label: string; value: NonNullable<CreateTaskValues["reasoningEffort"]> }> = [
    { label: locale === "zh-CN" ? "normal" : "normal", value: "medium" },
    { label: locale === "zh-CN" ? "high（默认）" : "high (default)", value: "high" },
    { label: locale === "zh-CN" ? "xhigh" : "xhigh", value: "xhigh" },
  ];

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
          initialValues={{ visibility: "public", autoCreateRepo: false, model: "gpt-5.4", reasoningEffort: "high" }}
          onFinish={(values) => void onCreateProject(values)}
        >
          <Form.Item
            name="name"
            label={locale === "zh-CN" ? "项目名称" : "Project name"}
            rules={[{ required: true, message: locale === "zh-CN" ? "请输入项目名称" : "Project name is required" }]}
          >
            <Input placeholder={locale === "zh-CN" ? "项目名称" : "Project name"} />
          </Form.Item>
          <Form.Item name="description" label={locale === "zh-CN" ? "描述" : "Description"}>
            <Input.TextArea rows={4} placeholder={locale === "zh-CN" ? "目标 / 范围 / 备注" : "Goal / scope / notes"} />
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
          <Typography.Text type="secondary">
            {locale === "zh-CN"
              ? "对需要 GitHub Pages 验收入口的 Web/UI 项目，公开仓库通常才支持直接部署。"
              : "For web/UI projects that need a GitHub Pages acceptance URL, public repositories usually work best."}
          </Typography.Text>
          <Form.Item name="model" label="Model">
            <Select options={[{ label: "gpt-5.4", value: "gpt-5.4" }]} />
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
            model: "gpt-5.4",
            reasoningEffort: "high",
            planMode: false,
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
            <Select options={[{ label: "gpt-5.4", value: "gpt-5.4" }]} />
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
      <Typography.Text type="secondary">
        {locale === "zh-CN" ? "当前状态筛选" : "Filter by status"}
      </Typography.Text>
      <Select
        value={value}
        onChange={(next) => onChange(next as StatusFilterValue)}
        options={[
          { label: locale === "zh-CN" ? "全部状态" : "All statuses", value: statusFilterAll },
          ...(Object.keys(statusLabel) as Array<keyof typeof statusLabel>).map((status) => ({
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
  const [acceptanceRejectModalOpen, setAcceptanceRejectModalOpen] = useState(false);
  const [acceptanceRejectFeedback, setAcceptanceRejectFeedback] = useState("");
  const [planResponseForm] = Form.useForm<Record<string, string | string[]>>();
  const logViews = buildLogViews(task.logs);
  const previewLogs = logViews.preview;
  const modalLogs = activeLogTrack === "operator" ? (logViews.operator.length ? logViews.operator : logViews.raw) : logViews.raw;
  const executionDecisionGate = task.executionDecisionGate;
  const supportsExecutionDecision = task.status === "waiting_user" && Boolean(executionDecisionGate);
  const supportsPlanFeedback = task.status === "waiting_user" && Boolean(task.planPreview) && !supportsExecutionDecision;
  const planQuestions = supportsExecutionDecision ? (executionDecisionGate?.form?.questions || []) : (task.planForm?.questions || []);
  const planResponseValues = Form.useWatch([], planResponseForm) as Record<string, string | string[] | undefined> | undefined;
  const hasOpenPlanQuestions = Boolean(planQuestions.length);
  const isTaskActionPending = Boolean(task.pendingAction?.blocksActions);
  const isPlanDraftPending = Boolean(task.planDraftPending || task.pendingAction?.type === "feedback");
  const isPlanSectionBusy = Boolean(task.status === "waiting_user" && task.pendingAction?.blocksActions);
  const isApprovalActionPending = task.pendingAction?.type === "approve" || task.pendingAction?.type === "reject";
  const isRetryPending = task.pendingAction?.type === "retry";
  const isStopPending = task.pendingAction?.type === "stop";
  const isAcceptanceRejectPending = task.pendingAction?.type === "reject";
  const trimmedAcceptanceRejectFeedback = acceptanceRejectFeedback.trim();
  const failureDiagnosis = getTaskFailureDiagnosis(task, locale);
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

  useEffect(() => {
    planResponseForm.resetFields();
    setLogModalOpen(false);
    setActiveLogTrack(logViews.hasStructuredOperatorLogs ? "operator" : "raw");
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
    const submitted = await onRespond(task.id, "approve", serialized);
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
            <Tag color={getDisplayedStatusColor(task, statusTagColor)}>
              {getDisplayedStatusText(task, locale, statusLabel)}
            </Tag>
          </Space>
          <Flex gap={8} wrap justify="flex-end">
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
              </>
            ) : null}
            {task.status === "running" ? (
              <Button danger loading={isStopPending} disabled={isTaskActionPending} onClick={() => void onMutate(task.id, "stop")}>
                {locale === "zh-CN" ? "停止" : "Stop"}
              </Button>
            ) : null}
            {task.status === "failed" || task.status === "stopped" || task.status === "needs_revision" || task.status === "publish_failed" ? (
              <Button loading={isRetryPending} disabled={isTaskActionPending} onClick={() => void onMutate(task.id, "retry")}>
                {task.executionMode === "orchestrated" && task.resumeEligible
                  ? (locale === "zh-CN" ? "恢复执行" : "Resume")
                  : locale === "zh-CN" ? "重试" : "Retry"}
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
                type={task.status === "failed" ? "error" : task.status === "waiting_user" ? "warning" : "info"}
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
                {task.openFailureReason ? (
                  <Typography.Text type="secondary">
                    {failureDiagnosis.rawReasonLabel}：{normalizeDisplayText(task.openFailureReason)}
                  </Typography.Text>
                ) : null}
              </Space>
            )}
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

        {supportsExecutionDecision ? (
          <Card size="small" className="full-width">
            <Spin
              spinning={isPlanSectionBusy}
              tip={
                task.pendingAction?.message
                || (locale === "zh-CN" ? "系统正在继续项目流" : "The project flow is continuing")
              }
            >
              <Typography.Text type="secondary">
                {locale === "zh-CN" ? "项目流决策" : "Project flow decision"}
              </Typography.Text>
              <Typography.Paragraph className="detail-text">
                {normalizeDisplayText(executionDecisionGate?.prompt || "")}
              </Typography.Paragraph>
              <Alert
                type="warning"
                showIcon
                message={
                  locale === "zh-CN"
                    ? "当前步骤已经产出结论，但后续方向仍需要你拍板。提交决策后项目流会继续执行。"
                    : "The current step produced a result, but the next direction still needs your decision before the project flow can continue."
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
                  loading={task.pendingAction?.type === "approve"}
                  onClick={() => void submitExecutionDecision()}
                  disabled={isPlanSectionBusy}
                >
                  {locale === "zh-CN" ? "提交决策并继续" : "Submit decision"}
                </Button>
                <Button
                  loading={task.pendingAction?.type === "reject"}
                  disabled={isPlanSectionBusy}
                  onClick={() => void onRespond(task.id, "reject", "")}
                >
                  {locale === "zh-CN" ? "停止项目流" : "Stop flow"}
                </Button>
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
                  disabled={isPlanSectionBusy || hasOpenPlanQuestions || hasDraftPlanResponse}
                >
                  {locale === "zh-CN" ? "确认计划并开始执行" : "Start execution"}
                </Button>
                <Button loading={task.pendingAction?.type === "reject"} disabled={isPlanSectionBusy} onClick={() => void onRespond(task.id, "reject", "")}>
                  {locale === "zh-CN" ? "拒绝" : "Reject"}
                </Button>
              </Flex>
            </Spin>
          </Card>
        ) : null}

        {task.status === "waiting_user" && !supportsPlanFeedback && !supportsExecutionDecision ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">
              {locale === "zh-CN" ? "审批操作" : "Approval actions"}
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
              <Button type="primary" loading={task.pendingAction?.type === "approve"} disabled={isTaskActionPending} onClick={() => void onRespond(task.id, "approve", "")}>
                {locale === "zh-CN" ? "通过" : "Approve"}
              </Button>
              <Button loading={task.pendingAction?.type === "reject"} disabled={isTaskActionPending} onClick={() => void onRespond(task.id, "reject", "")}>
                {locale === "zh-CN" ? "拒绝" : "Reject"}
              </Button>
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

        {task.openFailureReason ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">
              {failureDiagnosis?.rawReasonLabel || (locale === "zh-CN" ? "未完成原因" : "Why not completed")}
            </Typography.Text>
            <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
              {normalizeDisplayText(task.openFailureReason)}
            </Typography.Paragraph>
          </Card>
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
                    type={anomaly.status === "failed" || anomaly.status === "publish_failed" ? "error" : "warning"}
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

        {requirement.acceptanceCriteria?.length ? (
          <Card size="small">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "验收清单" : "Acceptance checklist"}</Typography.Text>
            <List
              className="detail-list"
              dataSource={requirement.acceptanceCriteria}
              renderItem={(criterion) => {
                const verification = requirement.verificationResults?.find((item) => item.criterionId === criterion.id);
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
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无日志" : "No logs yet"} />
        )}
      </Card>

      <Modal
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={null}
        width={880}
        title={locale === "zh-CN" ? "任务日志" : "Task logs"}
      >
        <Space direction="vertical" size={16} className="full-width">
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
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无日志" : "No logs yet"} />
          )}
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
                    ? "提交后系统会直接开始下一次返修；如果仍有需要你确认的信息，会再回到待你确认状态。"
                    : "Submitting this will start the next revision attempt immediately. If more input is needed, the task will return to waiting for your confirmation.")
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
            : approval.task.executionDecisionGate
            ? (
                locale === "zh-CN"
                  ? "当前项目步骤已经产出结论，等待你在详情页拍板后继续。"
                  : "The current project step produced a result and now needs your decision in the detail view."
              )
            : approval.task.planDraftPending
            ? (
                locale === "zh-CN"
                  ? "计划正在自动生成或更新，请点击详情查看最新版本。"
                  : "The plan is being generated or refreshed automatically. Open the detail view for the latest draft."
              )
            : approval.task.planForm?.questions?.length
            ? (
                locale === "zh-CN"
                  ? `有 ${approval.task.planForm.questions.length} 个待确认项，请在详情页完成回复。`
                  : `${approval.task.planForm.questions.length} open questions need responses in the detail view.`
              )
            : (
                locale === "zh-CN"
                  ? "请在详情页确认当前计划并决定是否开始执行。"
                  : "Review the current plan in the detail view before execution starts."
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
              ? "请在详情页处理中回复待确认项或启动执行。"
              : "Handle this approval in the detail view.")
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

export function HeaderSwitch({ checked, label, onToggle }: HeaderSwitchProps) {
  return (
    <Flex align="center" gap={8} className="header-switch-card">
      <Typography.Text>{label}</Typography.Text>
      <Switch
        checked={checked}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
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
