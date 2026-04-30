import { Button, Card, Form, Input, message, Select, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { createApiRequest } from "../dashboardClient";

const { TextArea } = Input;
const { Text } = Typography;

type DeepSeekTaskPanelProps = {
  isMobile: boolean;
};

const MODEL_OPTIONS = [
  { value: "deepseek-v4-pro[1m]", label: "V4 Pro [1M ctx]" },
  { value: "deepseek-v4-flash", label: "V4 Flash (fast)" },
];

export function DeepSeekTaskPanel({ isMobile }: DeepSeekTaskPanelProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const token = localStorage.getItem("codex.sessionToken") || "";
  const api = createApiRequest(token);

  async function handleSubmit(values: { title: string; prompt: string; model: string }) {
    setSubmitting(true);
    try {
      const body = {
        title: values.title || `DeepSeek: ${values.prompt.slice(0, 40)}`,
        prompt: values.prompt,
        model: values.model,
        provider: "deepseek",
        tags: ["deepseek", "ai-task"],
      };
      const result = await api<{ task: { id: string } }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      setLastTaskId(result.task.id);
      message.success(`Task submitted: ${result.task.id}`);
      form.resetFields();
    } catch (err) {
      message.error(`Failed: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      className={isMobile ? "pane-card" : "pane-card view-pane"}
      bordered={false}
      title={
        <Space>
          <span>DeepSeek Task</span>
          <Tag color="blue">V4</Tag>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="title" label="Task title (optional)">
          <Input placeholder="e.g. Analyze Q1 earnings report" maxLength={120} />
        </Form.Item>
        <Form.Item
          name="prompt"
          label="Prompt"
          rules={[{ required: true, message: "Enter a prompt" }]}
        >
          <TextArea rows={4} placeholder="What should DeepSeek do?" maxLength={4000} />
        </Form.Item>
        <Form.Item name="model" label="Model" initialValue="deepseek-v4-pro[1m]">
          <Select options={MODEL_OPTIONS} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          Submit DeepSeek Task
        </Button>
      </Form>
      {lastTaskId && (
        <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
          Last task: <Text code>{lastTaskId}</Text>
          {" — "}
          <a href={`/api/tasks/${lastTaskId}`} target="_blank" rel="noreferrer">
            View
          </a>
        </Text>
      )}
    </Card>
  );
}
