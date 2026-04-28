import { ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Flex, Progress, Space, Tag, Typography } from "antd";

import { MetricCard } from "./components/dashboardMetricComponents";
import { SectionHeader } from "./components/dashboardHeaderComponents";
import type { DashboardUsageViewModel } from "./dashboardControlTypes";

type UsagePageProps = {
  usageView: DashboardUsageViewModel;
  isMobile: boolean;
};

export function UsagePage({ usageView, isMobile }: UsagePageProps) {
  const { locale, usage, usageSummary, platformHealth, usageLimitSnapshots, modelStatusSnapshots, usageRefreshing, onRefreshUsage } = usageView;

  return (
    <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
      <SectionHeader
        title={locale === "zh-CN" ? "运行用量快照" : "Usage snapshot"}
        subtitle={locale === "zh-CN" ? "可手动刷新最新 CLI /status 快照" : "Manually refresh the latest CLI /status snapshot"}
        actions={(
          <Button icon={<ReloadOutlined />} loading={usageRefreshing} onClick={() => void onRefreshUsage()}>
            {locale === "zh-CN" ? "手动刷新" : "Refresh now"}
          </Button>
        )}
      />
      <div className="metric-grid metric-grid-wide">
        {usageLimitSnapshots.map((item) => (
          <MetricCard
            key={item.key}
            subtitle={item.subtitle}
            title={item.title}
            value={item.percentLabel}
            badge={item.sourceLabel}
            extra={
              <>
                <Progress percent={item.progressValue} size="small" showInfo={false} />
                <Flex justify="space-between" gap={12} wrap>
                  <Typography.Text type="secondary">
                    {item.available
                      ? item.detail
                      : locale === "zh-CN"
                        ? "当前接口暂无该窗口数据"
                        : "This API does not currently expose this window"}
                  </Typography.Text>
                  <Typography.Text type="secondary">{item.resetText}</Typography.Text>
                </Flex>
              </>
            }
          />
        ))}
      </div>

      <div className="metric-grid metric-grid-summary">
        <MetricCard
          subtitle={locale === "zh-CN" ? "摘要" : "Summary"}
          title={locale === "zh-CN" ? "用量说明" : "Usage overview"}
          value={usageSummary || (locale === "zh-CN" ? "暂无用量摘要。" : "No usage summary.")}
          valueTone="body"
          className="usage-summary-card"
        />
      </div>

      <SectionHeader
        title="Model /status"
        subtitle={locale === "zh-CN"
          ? "同时展示 gpt-5.4 与 gpt-5.3-codex-spark 的当前窗口用量"
          : "Current window usage for gpt-5.4 and gpt-5.3-codex-spark"}
      />
      <div className="metric-grid metric-grid-wide">
        {modelStatusSnapshots.map((item) => (
          <Card key={item.key} size="small" className="metric-card usage-model-card">
            <Space direction="vertical" size={12} className="full-width">
              <Flex justify="space-between" align="flex-start" gap={12}>
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">CLI /status</Typography.Text>
                  <Typography.Title level={5} className="metric-title">
                    {item.model}
                  </Typography.Title>
                </Space>
                {item.sourceLabel ? <Tag>{item.sourceLabel}</Tag> : null}
              </Flex>
              {item.available ? (
                <div className="usage-status-lines">
                  {item.lines.map((line) => (
                    <div key={line.key} className="usage-status-line">
                      <Flex justify="space-between" align="baseline" gap={12} wrap>
                        <Typography.Text strong>{line.title}</Typography.Text>
                        <Typography.Text>{line.percentLabel}</Typography.Text>
                      </Flex>
                      <Progress percent={line.progressValue} size="small" showInfo={false} />
                      <Flex justify="space-between" gap={12} wrap>
                        <Typography.Text type="secondary">
                          {line.available
                            ? line.detail
                            : locale === "zh-CN"
                              ? "当前接口暂无该窗口数据"
                              : "This API does not currently expose this window"}
                        </Typography.Text>
                        <Typography.Text type="secondary">{line.resetText}</Typography.Text>
                      </Flex>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">{item.emptyText}</Typography.Text>
              )}
              {item.collectedAtText ? <Typography.Text type="secondary">{item.collectedAtText}</Typography.Text> : null}
            </Space>
          </Card>
        ))}
      </div>

      <SectionHeader title={locale === "zh-CN" ? "运行指标" : "Runtime metrics"} />
      {usage ? (
        <div className="metric-grid">
          {[
            { label: locale === "zh-CN" ? "总任务数" : "Total tasks", value: usage.totalTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "未归档任务" : "Unarchived tasks", value: usage.unarchivedTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "待执行" : "Queued", value: usage.pendingTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "执行中" : "Running", value: usage.runningTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "待处理" : "Pending", value: usage.waitingTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "待验收" : "Awaiting acceptance", value: usage.awaitingAcceptanceTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "成功" : "Succeeded", value: usage.successfulTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "已取消" : "Cancelled", value: usage.cancelledTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "预估 token" : "Token estimate", value: usage.estimatedTokens, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "Worker 运行次数" : "Worker runs", value: usage.totalRuns, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "最近运行" : "Last run", value: usage.lastRunAt || "n/a", valueTone: "body" as const },
          ].map((item) => (
            <MetricCard
              key={item.label}
              subtitle={item.label}
              value={String(item.value)}
              valueTone={item.valueTone}
            />
          ))}
        </div>
      ) : (
        <Empty description={locale === "zh-CN" ? "暂无用量数据" : "No usage data"} />
      )}

      <SectionHeader title={locale === "zh-CN" ? "平台健康" : "Platform health"} />
      {platformHealth ? (
        <div className="metric-grid">
          {[
            { label: locale === "zh-CN" ? "任务后端" : "Task backend", value: platformHealth.taskBackend || "n/a", valueTone: "body" as const },
            {
              label: locale === "zh-CN" ? "健康快照" : "Health snapshot",
              value: platformHealth.generatedAt || "n/a",
              valueTone: "body" as const,
            },
            {
              label: locale === "zh-CN" ? "GitHub API 余量" : "GitHub API remaining",
              value: platformHealth.githubApi.remaining ?? "n/a",
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "GitHub API 队列" : "GitHub API queued",
              value: platformHealth.githubApi.queued,
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "最近发布方式" : "Last publish method",
              value: platformHealth.publishing.lastPublishMethod || "n/a",
              valueTone: "body" as const,
            },
            {
              label: locale === "zh-CN" ? "待执行任务" : "Queued tasks",
              value: platformHealth.taskState.pending,
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "待处理任务" : "Pending tasks",
              value: platformHealth.taskState.waiting,
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "待验收任务" : "Awaiting acceptance",
              value: platformHealth.taskState.awaitingAcceptance,
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "归档任务" : "Archived tasks",
              value: platformHealth.taskState.succeeded + platformHealth.taskState.cancelled,
              valueTone: "compact" as const,
            },
          ].map((item) => (
            <MetricCard
              key={item.label}
              subtitle={item.label}
              value={String(item.value)}
              valueTone={item.valueTone}
            />
          ))}
        </div>
      ) : (
        <Empty description={locale === "zh-CN" ? "暂无平台健康数据" : "No platform health data"} />
      )}

      <SectionHeader title={locale === "zh-CN" ? "异常与风险" : "Anomalies and risks"} />
      {platformHealth?.anomalies?.length ? (
        <div className="section-stack">
          {platformHealth.anomalies.map((anomaly) => (
            <Card key={anomaly.id} size="small" className="list-card">
              <Space direction="vertical" size={6} className="full-width">
                <Typography.Text strong>{`${anomaly.id} · ${anomaly.count} · ${anomaly.severity}`}</Typography.Text>
                <Typography.Text>{anomaly.description}</Typography.Text>
                {anomaly.taskIds?.length ? (
                  <Typography.Text type="secondary">{anomaly.taskIds.join(", ")}</Typography.Text>
                ) : null}
              </Space>
            </Card>
          ))}
        </div>
      ) : (
        <Empty description={locale === "zh-CN" ? "当前没有异常项" : "No anomalies detected"} />
      )}
    </Card>
  );
}
