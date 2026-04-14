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
  Switch,
  Tag,
  Typography,
} from "antd";
import { GlobalOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";

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
  onRespond: (taskId: string, decision: "approve" | "reject" | "feedback", feedback: string) => Promise<void>;
  anomalies: WorkspaceAnomaly[];
  dismissedAnomalyIds: Set<string>;
  onDismissAnomaly: (anomaly: WorkspaceAnomaly) => void;
  statusLabel: StatusLabelMap;
  statusTagColor: StatusTagColorMap;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
  normalizeDisplayText: (value: string) => string;
  buildLogViews: (logs: TaskLog[]) => { important: TaskLog[]; raw: TaskLog[] };
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
          initialValues={{ visibility: "private", autoCreateRepo: false, model: "gpt-5.4", reasoningEffort: "high" }}
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
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [planResponseForm] = Form.useForm<Record<string, string | string[]>>();
  const logViews = buildLogViews(task.logs);
  const visibleLogs = showRawLogs ? logViews.raw : logViews.important;
  const supportsPlanFeedback = task.status === "waiting_user" && Boolean(task.planPreview);
  const planQuestions = task.planForm?.questions || [];
  const planResponseValues = Form.useWatch([], planResponseForm) as Record<string, string | string[] | undefined> | undefined;
  const hasOpenPlanQuestions = Boolean(planQuestions.length);
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
    setShowRawLogs(false);
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

  async function submitPlanFeedback() {
    const questionNames = planQuestions.map((question) => question.id);
    const values = (await planResponseForm.validateFields([...questionNames, "__notes"])) as Record<string, string | string[] | undefined>;
    const serialized = serializePlanFeedback(task.planForm, values).trim();
    if (!serialized || serialized === (locale === "zh-CN" ? "本轮计划反馈" : "Plan feedback")) {
      return;
    }
    await onRespond(task.id, "feedback", serialized);
    planResponseForm.resetFields();
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
            <Tag color={statusTagColor[task.status]}>{statusLabel[task.status][locale]}</Tag>
          </Space>
          <Flex gap={8} wrap justify="flex-end">
            {task.status === "awaiting_acceptance" ? (
              <>
                <Button type="primary" onClick={() => void onRespond(task.id, "approve", "")}>
                  {locale === "zh-CN" ? "验收通过" : "Accept"}
                </Button>
                <Button onClick={() => void onRespond(task.id, "reject", "")}>
                  {locale === "zh-CN" ? "打回返修" : "Needs revision"}
                </Button>
              </>
            ) : null}
            {task.status === "running" ? (
              <Button danger onClick={() => void onMutate(task.id, "stop")}>
                {locale === "zh-CN" ? "停止" : "Stop"}
              </Button>
            ) : null}
            {task.status === "failed" || task.status === "stopped" || task.status === "needs_revision" || task.status === "publish_failed" ? (
              <Button onClick={() => void onMutate(task.id, "retry")}>
                {locale === "zh-CN" ? "重试" : "Retry"}
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

        {task.planPreview ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">{locale === "zh-CN" ? "计划预览" : "Plan preview"}</Typography.Text>
            <Typography.Paragraph className="preserve-breaks wrap-anywhere detail-text">
              {normalizeDisplayText(task.planPreview)}
            </Typography.Paragraph>
          </Card>
        ) : null}

        {supportsPlanFeedback ? (
          <Card size="small" className="full-width">
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
            {hasOpenPlanQuestions ? (
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
            <Form form={planResponseForm} layout="vertical">
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
                onClick={() => void submitPlanFeedback()}
                disabled={!hasOpenPlanQuestions && !hasDraftPlanResponse}
              >
                {locale === "zh-CN" ? "提交反馈继续规划" : "Submit feedback"}
              </Button>
              <Button
                type="primary"
                onClick={() => void onRespond(task.id, "approve", "")}
                disabled={hasOpenPlanQuestions || hasDraftPlanResponse}
              >
                {locale === "zh-CN" ? "确认计划并开始执行" : "Start execution"}
              </Button>
              <Button onClick={() => void onRespond(task.id, "reject", "")}>
                {locale === "zh-CN" ? "拒绝" : "Reject"}
              </Button>
            </Flex>
          </Card>
        ) : null}

        {task.status === "waiting_user" && !supportsPlanFeedback ? (
          <Card size="small" className="full-width">
            <Typography.Text type="secondary">
              {locale === "zh-CN" ? "审批操作" : "Approval actions"}
            </Typography.Text>
            <Flex gap={8} wrap style={{ marginTop: 12 }}>
              <Button type="primary" onClick={() => void onRespond(task.id, "approve", "")}>
                {locale === "zh-CN" ? "通过" : "Approve"}
              </Button>
              <Button onClick={() => void onRespond(task.id, "reject", "")}>
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
            <Typography.Text type="secondary">{locale === "zh-CN" ? "未完成原因" : "Why not completed"}</Typography.Text>
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
                      <Tag color={statusTagColor[attempt.status]}>{statusLabel[attempt.status][locale]}</Tag>
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
            task.logs.length > logViews.important.length ? (
              <Button onClick={() => setShowRawLogs((current) => !current)}>
                {showRawLogs
                  ? locale === "zh-CN"
                    ? "只看关键日志"
                    : "Show important only"
                  : locale === "zh-CN"
                    ? "展开原始日志"
                    : "Show raw logs"}
              </Button>
            ) : undefined
          }
        />
        {visibleLogs.length ? (
          <List
            className="detail-list"
            dataSource={visibleLogs}
            renderItem={(entry) => (
              <List.Item key={`${entry.timestamp}-${entry.message}`}>
                <Space direction="vertical" size={4}>
                  <Typography.Text type="secondary">{new Date(entry.timestamp).toLocaleString(locale)}</Typography.Text>
                  <Typography.Text className="wrap-anywhere preserve-breaks">
                    {normalizeDisplayText(entry.message)}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无关键日志" : "No important logs yet"} />
        )}
      </Card>
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
          {approval.task.planForm?.questions?.length
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
          <Tag color={statusTagColor[approval.task.status]}>{statusLabel[approval.task.status][locale]}</Tag>
          <Typography.Text type="secondary">
            {getProjectDisplayName(approval.task.projectId, locale, approval.task.projectName)} · {approval.task.type}
          </Typography.Text>
        </Space>
        <Alert
          type="warning"
          showIcon
          message={
            locale === "zh-CN"
              ? "请在详情页处理中回复待确认项或启动执行。"
              : "Handle this approval in the detail view."
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
