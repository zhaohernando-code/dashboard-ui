import type { ReactNode } from "react";
import { Flex, Segmented, Space, Switch, Typography } from "antd";
import { GlobalOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import type { Locale } from "../dashboardTypes";

type HeaderSwitchProps = {
  checked: boolean;
  label: string;
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
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


export function HeaderSwitch({ checked, label, checkedChildren, unCheckedChildren, onToggle }: HeaderSwitchProps) {
  return (
    <Flex align="center" gap={8} className="header-switch-card">
      <Typography.Text>{label}</Typography.Text>
      <Switch
        checked={checked}
        checkedChildren={<span className="header-switch-icon">{checkedChildren || <MoonOutlined />}</span>}
        unCheckedChildren={<span className="header-switch-icon">{unCheckedChildren || <SunOutlined />}</span>}
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
