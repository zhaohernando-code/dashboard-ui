import { Suspense, lazy } from "react";
import { App as AntApp, ConfigProvider, Flex, Spin, theme as antdTheme } from "antd";

import { useDashboardController } from "./dashboardController";
import { DashboardShell } from "./dashboardShell";
import { DeepSeekTaskPanel } from "./components/DeepSeekTaskPanel";

const WorkspacePage = lazy(() => import("./dashboardWorkspacePage").then((module) => ({ default: module.WorkspacePage })));
const WatchdogPage = lazy(() => import("./dashboardWatchdogPage").then((module) => ({ default: module.WatchdogPage })));
const ToolsPage = lazy(() => import("./dashboardToolsPage").then((module) => ({ default: module.ToolsPage })));
const UsagePage = lazy(() => import("./dashboardUsagePage").then((module) => ({ default: module.UsagePage })));

function PageFallback() {
  return (
    <Flex align="center" justify="center" className="pane-card view-pane" style={{ minHeight: 240 }}>
      <Spin size="large" />
    </Flex>
  );
}

export default function App() {
  const controller = useDashboardController();
  const { shell, tools, usage, watchdog, workspace } = controller;

  return (
    <ConfigProvider
      theme={{
        algorithm: shell.theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#1f66ff",
          borderRadius: 18,
          fontFamily: '"IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif',
          fontFamilyCode: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
        },
      }}
    >
      <AntApp>
        <DashboardShell shell={shell}>
          <Suspense fallback={<PageFallback />}>
            {shell.activeTab === "quest-center" ? <WorkspacePage workspace={workspace} /> : null}
            {shell.activeTab === "watchdog" ? <WatchdogPage watchdogView={watchdog} isMobile={shell.isMobile} /> : null}
            {shell.activeTab === "tools" ? (
              <>
                <DeepSeekTaskPanel isMobile={shell.isMobile} />
                <ToolsPage toolsView={tools} isMobile={shell.isMobile} />
              </>
            ) : null}
            {shell.activeTab === "usage" ? <UsagePage usageView={usage} isMobile={shell.isMobile} /> : null}
          </Suspense>
        </DashboardShell>
      </AntApp>
    </ConfigProvider>
  );
}
