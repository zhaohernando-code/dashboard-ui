import { Card, Empty, List, Space, Tag, Typography } from "antd";

import { MetricCard, SectionHeader } from "./dashboardComponents";
import type { DashboardToolsViewModel } from "./dashboardControlTypes";

type ToolsPageProps = {
  toolsView: DashboardToolsViewModel;
  isMobile: boolean;
};

export function ToolsPage({ toolsView, isMobile }: ToolsPageProps) {
  const { locale, tools } = toolsView;

  function getDeploymentTag(tool: DashboardToolsViewModel["tools"][number]) {
    const status = String(tool.deploymentStatus || "").trim().toLowerCase();
    if (status === "ready") {
      return <Tag color="success">{locale === "zh-CN" ? "已就绪" : "Ready"}</Tag>;
    }
    if (status === "deploying") {
      return <Tag color="processing">{locale === "zh-CN" ? "部署中" : "Deploying"}</Tag>;
    }
    if (status === "failed") {
      return <Tag color="error">{locale === "zh-CN" ? "部署失败" : "Failed"}</Tag>;
    }
    if (status === "pending") {
      return <Tag color="warning">{locale === "zh-CN" ? "待部署" : "Pending"}</Tag>;
    }
    return null;
  }

  return (
    <Card className={isMobile ? "pane-card" : "pane-card view-pane"} bordered={false}>
      <SectionHeader title={locale === "zh-CN" ? "工具路由" : "Tool routes"} />
      {tools.length ? (
        <List
          dataSource={tools}
          renderItem={(tool) => (
            <List.Item>
              <MetricCard
                subtitle={tool.name}
                value={tool.description || (locale === "zh-CN" ? "无描述" : "No description")}
                valueTone="body"
                className="list-card full-width"
                extra={
                  <Space direction="vertical" size={8} className="full-width">
                    {getDeploymentTag(tool)}
                    {tool.deploymentStatus === "ready" || !tool.deploymentStatus ? (
                      <a className="wrap-anywhere" href={tool.route} target="_blank" rel="noreferrer">
                        {locale === "zh-CN" ? `打开 ${tool.route}` : `Open ${tool.route}`}
                      </a>
                    ) : (
                      <Typography.Text className="wrap-anywhere" type={tool.deploymentStatus === "failed" ? "danger" : undefined}>
                        {tool.deploymentStatus === "failed"
                          ? (tool.deploymentError || (locale === "zh-CN" ? "当前部署失败，请先修复后再验收。" : "Deployment failed. Fix it before acceptance."))
                          : locale === "zh-CN"
                            ? "当前工具还在补齐交付物，暂时不能直接打开。"
                            : "This tool is still finishing delivery and cannot be opened yet."}
                      </Typography.Text>
                    )}
                    {tool.repository ? (
                      <a className="wrap-anywhere" href={tool.repository} target="_blank" rel="noreferrer">
                        {locale === "zh-CN" ? `查看仓库 ${tool.repository}` : `Open repository ${tool.repository}`}
                      </a>
                    ) : null}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty description={locale === "zh-CN" ? "暂无工具路由" : "No tools"} />
      )}
    </Card>
  );
}
