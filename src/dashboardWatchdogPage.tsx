import { Alert, Button, Card, Empty, List, Space, Tag, Typography } from "antd";

import { SectionHeader } from "./dashboardComponents";
import type { DashboardWatchdogViewModel } from "./dashboardControlTypes";

type WatchdogPageProps = {
  watchdogView: DashboardWatchdogViewModel;
  isMobile: boolean;
};

function formatSessionTime(value: string | undefined, locale: "zh-CN" | "en-US") {
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

function getPhaseLabel(phase: string, locale: "zh-CN" | "en-US") {
  const normalized = String(phase || "").trim();
  if (locale === "zh-CN") {
    switch (normalized) {
      case "reviewing":
        return "分析中";
      case "remediating":
        return "修复中";
      case "revalidating":
        return "复检中";
      case "passed":
        return "已通过";
      case "validated_blocked":
        return "真实阻塞";
      case "escalated":
        return "已升级";
      case "acknowledged":
        return "已确认";
      default:
        return normalized || "待处理";
    }
  }
  switch (normalized) {
    case "reviewing":
      return "Reviewing";
    case "remediating":
      return "Remediating";
    case "revalidating":
      return "Revalidating";
    case "passed":
      return "Passed";
    case "validated_blocked":
      return "Validated blocked";
    case "escalated":
      return "Escalated";
    case "acknowledged":
      return "Acknowledged";
    default:
      return normalized || "Queued";
  }
}

export function WatchdogPage({ watchdogView, isMobile }: WatchdogPageProps) {
  const { locale, overview, activeSession, onAcknowledge, onOpenTask } = watchdogView;

  return (
    <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
      <SectionHeader
        title={locale === "zh-CN" ? "看护模式" : "Watchdog"}
        subtitle={overview?.enabled
          ? (locale === "zh-CN" ? "任务关键状态变化时先做健康校验，再决定是否继续队列。" : "Validate critical task transitions before the queue continues.")
          : (locale === "zh-CN" ? "当前已关闭，看护不会暂停队列。" : "Disabled. The queue proceeds without watchdog validation.")}
      />

      {overview ? (
        <div className="section-stack">
          <Alert
            type={overview.queuePaused ? "warning" : "info"}
            showIcon
            message={overview.queuePaused
              ? (locale === "zh-CN" ? "队列当前被看护暂停" : "The queue is currently paused by watchdog")
              : (locale === "zh-CN" ? "队列当前没有被看护暂停" : "The queue is not paused by watchdog")}
            description={overview.pauseReason || (locale === "zh-CN" ? "当前没有活动中的看护会话。" : "There is no active watchdog session.")}
          />

          {activeSession ? (
            <Card size="small" className="list-card">
              <Space direction="vertical" size={10} className="full-width">
                <Space wrap>
                  <Typography.Text strong>{activeSession.taskTitle || activeSession.taskId}</Typography.Text>
                  <Tag color={activeSession.requiresAcknowledgement ? "orange" : "blue"}>
                    {getPhaseLabel(activeSession.phase, locale)}
                  </Tag>
                  <Tag>{activeSession.projectName || activeSession.projectId}</Tag>
                </Space>
                <Typography.Text>{activeSession.summary}</Typography.Text>
                <Typography.Text type="secondary">
                  {locale === "zh-CN" ? "开始时间：" : "Started:"} {formatSessionTime(activeSession.startedAt, locale)}
                </Typography.Text>
                {activeSession.externalInput ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={locale === "zh-CN" ? "需要外部输入" : "External input required"}
                    description={activeSession.externalInput}
                  />
                ) : null}
                {activeSession.findings.length ? (
                  <Space direction="vertical" size={8} className="full-width">
                    {activeSession.findings.map((finding) => (
                      <Alert
                        key={`${activeSession.id}-${finding.code}`}
                        type={finding.severity === "critical" ? "error" : "warning"}
                        showIcon
                        message={finding.summary}
                        description={finding.detail}
                      />
                    ))}
                  </Space>
                ) : null}
                <Space wrap>
                  <Button onClick={() => onOpenTask(activeSession.taskId)}>
                    {locale === "zh-CN" ? "打开任务" : "Open task"}
                  </Button>
                  {activeSession.requiresAcknowledgement ? (
                    <Button type="primary" onClick={() => void onAcknowledge(activeSession.id)}>
                      {locale === "zh-CN" ? "确认并继续队列" : "Acknowledge and continue"}
                    </Button>
                  ) : null}
                </Space>
              </Space>
            </Card>
          ) : null}

          <SectionHeader title={locale === "zh-CN" ? "最近会话" : "Recent sessions"} />
          {overview.recentSessions.length ? (
            <List
              dataSource={overview.recentSessions}
              renderItem={(session) => (
                <List.Item
                  actions={[
                    <Button key="open" size="small" onClick={() => onOpenTask(session.taskId)}>
                      {locale === "zh-CN" ? "任务" : "Task"}
                    </Button>,
                    ...(session.requiresAcknowledgement
                      ? [
                          <Button key="ack" size="small" type="primary" onClick={() => void onAcknowledge(session.id)}>
                            {locale === "zh-CN" ? "确认" : "Acknowledge"}
                          </Button>,
                        ]
                      : []),
                  ]}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <Typography.Text strong>{session.taskTitle || session.taskId}</Typography.Text>
                        <Tag color={session.requiresAcknowledgement ? "orange" : session.queuePaused ? "blue" : "default"}>
                          {getPhaseLabel(session.phase, locale)}
                        </Tag>
                      </Space>
                    )}
                    description={(
                      <Space direction="vertical" size={4} className="full-width">
                        <Typography.Text>{session.summary}</Typography.Text>
                        <Typography.Text type="secondary">
                          {session.projectName || session.projectId} · {formatSessionTime(session.updatedAt || session.startedAt, locale)}
                        </Typography.Text>
                      </Space>
                    )}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description={locale === "zh-CN" ? "暂无看护会话" : "No watchdog sessions"} />
          )}
        </div>
      ) : (
        <Empty description={locale === "zh-CN" ? "暂无看护数据" : "No watchdog data"} />
      )}
    </Card>
  );
}
