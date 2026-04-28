import { useState } from "react";
import { Alert, Button, Checkbox, Flex, Form, Input, InputNumber, Modal, Radio, Select, Space, Switch, Tag, Typography } from "antd";
import type { CreateDialogMode, CreateProjectValues, CreateTaskValues, Locale, Project } from "../dashboardTypes";
import { DEFAULT_TASK_MODEL, FAST_TASK_MODEL, TASK_MODEL_OPTIONS } from "../dashboardConstants";

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
