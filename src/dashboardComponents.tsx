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

import { CreateDialog } from "./components/dashboardCreateDialog";
import { StatusFilterBar } from "./components/dashboardStatusFilter";
import { ApprovalCard } from "./components/dashboardApprovalCard";
import { HeaderSwitch, HeaderLocaleSwitch, SectionHeader } from "./components/dashboardHeaderComponents";
import { ListPagination, MetricCard } from "./components/dashboardMetricComponents";
import { getDisplayedStatusText, getDisplayedStatusColor, formatTaskTimestamp, findStatusTimestamp, getTaskFailureDiagnosis } from "./dashboardTaskHelpers";

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
  buildLogViews: (logs: TaskLog[], totalCount?: number) => LogViews;
};

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
  const logViews = buildLogViews(task.logs, task.logTotal ?? task.logs.length);
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
                  {logViews.omittedCount > 0
                    ? (locale === "zh-CN"
                      ? `较早的 ${logViews.omittedCount} 条日志未加载，当前只保留最近窗口。`
                      : `${logViews.omittedCount} older log entries are not loaded; the UI keeps only the latest window.`)
                    : (locale === "zh-CN"
                      ? `还有 ${logViews.hiddenCount} 条未展开日志，点击“查看全部日志”浏览完整记录。`
                      : `${logViews.hiddenCount} more log entries are hidden from the preview. Open the full log view to inspect them.`)}
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

