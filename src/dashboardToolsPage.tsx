import { Card, Empty, List, Space, Typography } from "antd";

import { MetricCard, SectionHeader } from "./dashboardComponents";
import type { DashboardToolsViewModel } from "./dashboardControlTypes";

type ToolsPageProps = {
  toolsView: DashboardToolsViewModel;
  isMobile: boolean;
};

export function ToolsPage({ toolsView, isMobile }: ToolsPageProps) {
  const { locale, tools } = toolsView;

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
                    <a className="wrap-anywhere" href={tool.route} target="_blank" rel="noreferrer">
                      {locale === "zh-CN" ? `打开 ${tool.route}` : `Open ${tool.route}`}
                    </a>
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
