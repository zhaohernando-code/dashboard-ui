import type { ReactNode } from "react";
import { Alert, Button, Card, Drawer, Flex, Layout, Segmented, Space, Tabs, Typography } from "antd";
import { EyeInvisibleOutlined, EyeOutlined, MenuOutlined } from "@ant-design/icons";

import { HeaderLocaleSwitch, HeaderSwitch, SectionHeader } from "./components/dashboardHeaderComponents";
import { tabs, type DashboardShellViewModel } from "./dashboardConstants";

type DashboardShellProps = {
  shell: DashboardShellViewModel;
  children: ReactNode;
};

export function DashboardShell({ shell, children }: DashboardShellProps) {
  const { copy } = shell;

  return (
    <Layout className="app-shell">
      <div className="app-root">
        <Card className="topbar-card" bordered={false}>
          <Flex justify="space-between" align="center" gap={16} wrap>
            <Flex align="center" gap={14} className="brand-wrap">
              <div className="brand-mark" aria-hidden="true">
                C
              </div>
              <div className="brand-copy">
                <Typography.Title level={3} className="brand-title">
                  {copy.title}
                </Typography.Title>
                <Typography.Text type="secondary" className="brand-subtitle">
                  {copy.subtitle}
                </Typography.Text>
              </div>
            </Flex>
            <Space size={12} wrap className="topbar-actions">
              {!shell.isMobile ? (
                <>
                  <HeaderSwitch
                    checked={shell.watchdogEnabled}
                    label={copy.watchdogSetting}
                    checkedChildren={<EyeOutlined />}
                    unCheckedChildren={<EyeInvisibleOutlined />}
                    onToggle={() => void shell.onToggleWatchdog(!shell.watchdogEnabled)}
                  />
                  <HeaderSwitch
                    checked={shell.theme === "dark"}
                    label={copy.themeSetting}
                    onToggle={shell.onToggleTheme}
                  />
                  <HeaderLocaleSwitch
                    label={copy.languageSetting}
                    value={shell.locale}
                    onChange={shell.onChangeLocale}
                  />
                  {shell.authConfig?.user ? (
                    <Button onClick={() => void shell.onLogout()}>{copy.logoutButton}</Button>
                  ) : shell.authConfig?.enabled ? (
                    <Button
                      type="primary"
                      onClick={() => void shell.onLogin()}
                    >
                      {copy.loginButton}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </Space>
          </Flex>
        </Card>

        {shell.deviceLogin ? (
          <Card className="section-card" bordered={false}>
            <SectionHeader
              title={shell.locale === "zh-CN" ? "GitHub 设备登录" : "GitHub Device Login"}
              subtitle={
                shell.locale === "zh-CN"
                  ? "打开链接并输入验证码，页面会在当前会话中自动轮询。"
                  : "Open the link and enter the code. Polling stays inside this session."
              }
              actions={
                <Button onClick={shell.onCancelDeviceLogin}>
                  {shell.locale === "zh-CN" ? "关闭" : "Close"}
                </Button>
              }
            />
            <Space direction="vertical" size={16} className="block-stack full-width">
              <Space wrap>
                <a href={shell.deviceLogin.verificationUri} target="_blank" rel="noreferrer">
                  {shell.deviceLogin.verificationUri}
                </a>
                <Button type="primary" onClick={() => void shell.onCopyDeviceCode()}>
                  {shell.copyState === "copied"
                    ? (shell.locale === "zh-CN" ? "已复制" : "Copied")
                    : shell.locale === "zh-CN"
                      ? "复制验证码"
                      : "Copy code"}
                </Button>
              </Space>
              <Typography.Text code className="device-code">
                {shell.deviceLogin.userCode}
              </Typography.Text>
              <Alert type="info" message={shell.deviceLogin.status} showIcon />
              {shell.deviceLogin.error ? <Alert type="error" message={shell.deviceLogin.error} showIcon /> : null}
            </Space>
          </Card>
        ) : null}

        {shell.watchdogBanner ? (
          <Alert
            type={shell.watchdogBanner.tone}
            showIcon
            className="section-card"
            message={shell.watchdogBanner.title}
            description={shell.watchdogBanner.detail}
            action={(
              <Space wrap>
                <Button size="small" onClick={() => shell.onChangeTab("watchdog")}>
                  {shell.locale === "zh-CN" ? "查看看护" : "Open watchdog"}
                </Button>
                {shell.watchdogBanner.requiresAcknowledgement && shell.watchdogBanner.sessionId ? (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => void shell.onAcknowledgeWatchdog(shell.watchdogBanner!.sessionId!)}
                  >
                    {shell.locale === "zh-CN" ? "确认并继续" : "Acknowledge"}
                  </Button>
                ) : null}
              </Space>
            )}
          />
        ) : null}

        {shell.notices.length ? (
          <div className="notice-stack" aria-live="polite" aria-atomic="true">
            {shell.notices.map((notice) => (
              <section key={notice.id} className={`notice notice-${notice.tone}`}>
                {notice.message}
              </section>
            ))}
          </div>
        ) : null}

        {!shell.isMobile ? (
          <div className="tabs-strip">
            <Tabs
              activeKey={shell.activeTab}
              onChange={(value) => shell.onChangeTab(value as typeof shell.activeTab)}
              items={tabs.map((tab) => ({
                key: tab.id,
                label: tab.label[shell.locale],
              }))}
              className="desktop-tabs"
            />
          </div>
        ) : (
          <Button
            type="primary"
            icon={<MenuOutlined />}
            className="mobile-nav-trigger"
            onClick={shell.onOpenMobileNav}
          >
            {copy.mobileControlTitle}
          </Button>
        )}

        <Drawer
          title={
            <div className="mobile-drawer-title">
              <Segmented
                block
                options={tabs.map((tab) => ({ label: tab.label[shell.locale], value: tab.id }))}
                value={shell.activeTab}
                onChange={(value) => shell.onChangeTab(value as typeof shell.activeTab)}
              />
            </div>
          }
          placement="bottom"
          height="auto"
          open={shell.isMobileNavOpen}
          onClose={shell.onCloseMobileNav}
          className="mobile-drawer"
        >
          <Space direction="vertical" size={16} className="full-width">
            <HeaderSwitch
              checked={shell.watchdogEnabled}
              label={copy.watchdogSetting}
              checkedChildren={<EyeOutlined />}
              unCheckedChildren={<EyeInvisibleOutlined />}
              onToggle={() => void shell.onToggleWatchdog(!shell.watchdogEnabled)}
            />
            <HeaderSwitch
              checked={shell.theme === "dark"}
              label={copy.themeSetting}
              onToggle={shell.onToggleTheme}
            />
            <HeaderLocaleSwitch
              label={copy.languageSetting}
              value={shell.locale}
              onChange={shell.onChangeLocale}
            />
            {shell.authConfig?.user ? (
              <Button block onClick={() => void shell.onLogout()}>
                {copy.logoutButton}
              </Button>
            ) : shell.authConfig?.enabled ? (
              <Button
                block
                type="primary"
                onClick={() => void shell.onLogin()}
              >
                {copy.loginButton}
              </Button>
            ) : null}
          </Space>
        </Drawer>

        {children}
      </div>
    </Layout>
  );
}
