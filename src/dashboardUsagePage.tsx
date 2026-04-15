import { Card, Empty, Flex, Progress, Space, Typography } from "antd";

import { MetricCard, SectionHeader } from "./dashboardComponents";
import type { DashboardUsageViewModel } from "./dashboardControlTypes";

type UsagePageProps = {
  usageView: DashboardUsageViewModel;
  isMobile: boolean;
};

export function UsagePage({ usageView, isMobile }: UsagePageProps) {
  const { locale, usage, usageSummary, platformHealth, usageLimitSnapshots } = usageView;

  return (
    <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
      <SectionHeader title={locale === "zh-CN" ? "运行用量快照" : "Usage snapshot"} />
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

      <SectionHeader title={locale === "zh-CN" ? "运行指标" : "Runtime metrics"} />
      {usage ? (
        <div className="metric-grid">
          {[
            { label: locale === "zh-CN" ? "总任务数" : "Total tasks", value: usage.totalTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "活动任务" : "Active tasks", value: usage.activeTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "待审批" : "Pending approvals", value: usage.pendingApprovals, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "已完成" : "Completed", value: usage.completedTasks, valueTone: "compact" as const },
            { label: locale === "zh-CN" ? "失败" : "Failed", value: usage.failedTasks, valueTone: "compact" as const },
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
            { label: locale === "zh-CN" ? "Issue Poller" : "Issue poller", value: platformHealth.issuePoller.status, valueTone: "compact" as const },
            {
              label: locale === "zh-CN" ? "轮询周期" : "Poll interval",
              value: platformHealth.issuePoller.intervalMs ? `${platformHealth.issuePoller.intervalMs}ms` : "n/a",
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "最近成功轮询" : "Last poll success",
              value: platformHealth.issuePoller.lastSuccessAt || "n/a",
              valueTone: "body" as const,
            },
            {
              label: locale === "zh-CN" ? "GitHub API 余量" : "GitHub API remaining",
              value: platformHealth.githubApi.remaining ?? "n/a",
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "最近发布方式" : "Last publish method",
              value: platformHealth.publishing.lastPublishMethod || "n/a",
              valueTone: "body" as const,
            },
            {
              label: locale === "zh-CN" ? "待验收需求" : "Awaiting acceptance",
              value: platformHealth.taskState.awaitingAcceptance,
              valueTone: "compact" as const,
            },
            {
              label: locale === "zh-CN" ? "待返修需求" : "Needs revision",
              value: platformHealth.taskState.needsRevision + platformHealth.taskState.publishFailed,
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
