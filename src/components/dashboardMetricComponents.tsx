import type { ReactNode } from "react";
import type { Locale } from "../dashboardTypes";
import { Card, Flex, Pagination, Space, Statistic, Tag, Typography } from "antd";

type MetricCardProps = {
  subtitle: string;
  title?: string;
  value: string;
  badge?: string;
  extra?: ReactNode;
  className?: string;
  valueTone?: "hero" | "compact" | "body";
};

type ListPaginationProps = {
  locale: Locale;
  current: number;
  pageSize: number;
  total: number;
  itemLabel: Record<Locale, string>;
  onChange: (page: number) => void;
};


export function ListPagination({
  locale,
  current,
  pageSize,
  total,
  itemLabel,
  onChange,
}: ListPaginationProps) {
  if (total <= pageSize) {
    return null;
  }

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  return (
    <Flex justify="space-between" align="center" gap={12} wrap className="list-pagination">
      <Typography.Text type="secondary">
        {locale === "zh-CN"
          ? `第 ${start}-${end} 条，共 ${total} 条${itemLabel[locale]}`
          : `${start}-${end} of ${total} ${itemLabel[locale]}`}
      </Typography.Text>
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        showSizeChanger={false}
        responsive
        onChange={onChange}
      />
    </Flex>
  );
}

export function MetricCard({
  subtitle,
  title,
  value,
  badge,
  extra,
  className,
  valueTone = "hero",
}: MetricCardProps) {
  const cardClassName = ["metric-card", className].filter(Boolean).join(" ");

  return (
    <Card size="small" className={cardClassName}>
      <Space direction="vertical" size={valueTone === "hero" ? 12 : 10} className="full-width">
        <Flex justify="space-between" align="flex-start" gap={12}>
          <Space direction="vertical" size={2}>
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
            {title ? (
              <Typography.Title level={5} className="metric-title">
                {title}
              </Typography.Title>
            ) : null}
          </Space>
          {badge ? <Tag>{badge}</Tag> : null}
        </Flex>
        {valueTone === "body" ? (
          <Typography.Paragraph className="metric-value metric-value-body wrap-anywhere">
            {value}
          </Typography.Paragraph>
        ) : (
          <Typography.Title
            level={valueTone === "hero" ? 2 : 4}
            className={`metric-value metric-value-${valueTone} wrap-anywhere`}
          >
            {value}
          </Typography.Title>
        )}
        {extra ? <div>{extra}</div> : null}
      </Space>
    </Card>
  );
}
