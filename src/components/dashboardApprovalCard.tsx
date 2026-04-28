import { Alert, Button, Card, Descriptions, Flex, Space, Tag, Typography } from "antd";
import type { Approval, Locale, StatusLabelMap, StatusTagColorMap } from "../dashboardTypes";
import { getDisplayedStatusText, getDisplayedStatusColor } from "../dashboardTaskHelpers";
import { canCancelTask, getTaskPendingReason } from "../dashboardTaskState";

type ApprovalCardProps = {
  approval: Approval;
  locale: Locale;
  onOpenTask: (taskId: string) => void;
  statusLabel: StatusLabelMap;
  statusTagColor: StatusTagColorMap;
  getProjectDisplayName: (projectId: string, locale: Locale, displayName?: string) => string;
};


export function ApprovalCard({
  approval,
  locale,
  onOpenTask,
  statusLabel,
  statusTagColor,
  getProjectDisplayName,
}: ApprovalCardProps) {
  return (
    <Card size="small" className="list-card">
      <Space direction="vertical" size={10} className="full-width">
        <Typography.Text strong className="wrap-anywhere">
          {approval.task.title}
        </Typography.Text>
        <Typography.Text type="secondary" className="wrap-anywhere">
          {approval.task.userAction?.title || approval.reason}
        </Typography.Text>
        <Typography.Text type="secondary" className="wrap-anywhere">
          {approval.task.pendingAction?.message
            ? approval.task.pendingAction.message
            : getTaskPendingReason(approval.task) === "user_decision"
            ? (
                locale === "zh-CN"
                  ? "当前任务需要你在详情页补充拍板意见后继续。"
                  : "This task needs your decision input in the detail view."
              )
            : getTaskPendingReason(approval.task) === "plan_feedback" && approval.task.planDraftPending
            ? (
                locale === "zh-CN"
                  ? "计划正在自动生成或更新，请点击详情查看最新版本。"
                  : "The plan is being generated or refreshed automatically. Open the detail view for the latest draft."
              )
            : getTaskPendingReason(approval.task) === "plan_feedback" && approval.task.planForm?.questions?.length
            ? (
                locale === "zh-CN"
                  ? `有 ${approval.task.planForm.questions.length} 个待确认项，请在详情页完成回复。`
                  : `${approval.task.planForm.questions.length} open questions need responses in the detail view.`
              )
            : getTaskPendingReason(approval.task) === "manual_intervention"
            ? (
                canCancelTask(approval.task)
                  ? (
                      locale === "zh-CN"
                        ? "当前任务处于系统跟进状态，请在详情页查看当前处理结果；只有确实需要你的判断时才会单独提示。"
                        : "This task is under system follow-up. Open the detail view to inspect the current state; you will only be asked for input when a real decision is needed."
                    )
                  : (
                      locale === "zh-CN"
                        ? "当前任务处于系统跟进状态，请在详情页查看最新结果；若发布结果不符合预期，请直接打回返修。"
                        : "This task is under system follow-up. Open the detail view for the latest result; if the published output is wrong, send it back for revision."
                    )
              )
            : (
                locale === "zh-CN"
                  ? "请在详情页查看当前处理状态。"
                  : "Open the detail view for the current task state."
              )}
        </Typography.Text>
        <Space wrap>
          <Tag color={getDisplayedStatusColor(approval.task, statusTagColor)}>
            {getDisplayedStatusText(approval.task, locale, statusLabel)}
          </Tag>
          <Typography.Text type="secondary">
            {getProjectDisplayName(approval.task.projectId, locale, approval.task.projectName)} · {approval.task.type}
          </Typography.Text>
        </Space>
        <Alert
          type={approval.task.pendingAction ? (approval.task.pendingAction.phase === "timed_out" ? "warning" : "info") : "warning"}
          showIcon
          message={
            approval.task.pendingAction?.message
            || (locale === "zh-CN"
              ? "请在详情页查看当前待处理状态。"
              : "Open the detail view for the current pending state.")
          }
        />
        <Flex gap={8} wrap>
          <Button onClick={() => onOpenTask(approval.task.id)}>
            {locale === "zh-CN" ? "去详情处理" : "Open detail"}
          </Button>
        </Flex>
      </Space>
    </Card>
  );
}
