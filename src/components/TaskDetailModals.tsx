import { useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  List,
  Modal,
  Segmented,
  Space,
  Spin,
  Typography,
} from "antd";
import { getLogSummaryText, getLogTrackLabel, type LogTrack, type LogViews } from "../dashboardLogs";
import type { Locale } from "../types";

type TaskDetailModalsProps = {
  locale: Locale;
  logModalOpen: boolean;
  setLogModalOpen: (v: boolean) => void;
  activeLogTrack: LogTrack;
  setActiveLogTrack: (v: LogTrack) => void;
  cancelConfirmOpen: boolean;
  setCancelConfirmOpen: (v: boolean) => void;
  acceptanceRejectModalOpen: boolean;
  setAcceptanceRejectModalOpen: (v: boolean) => void;
  acceptanceRejectFeedback: string;
  setAcceptanceRejectFeedback: (v: string) => void;
  isCancelPending: boolean;
  isAcceptanceRejectPending: boolean;
  trimmedAcceptanceRejectFeedback: string;
  logViews: LogViews;
  logsLoading: boolean;
  logsError: string;
  normalizeDisplayText: (value: string) => string;
  taskExecutionMode: string;
  submitCancel: () => Promise<void>;
  submitAcceptanceReject: () => Promise<void>;
};

export function TaskDetailModals({
  locale,
  logModalOpen, setLogModalOpen,
  activeLogTrack, setActiveLogTrack,
  cancelConfirmOpen, setCancelConfirmOpen,
  acceptanceRejectModalOpen, setAcceptanceRejectModalOpen,
  acceptanceRejectFeedback, setAcceptanceRejectFeedback,
  isCancelPending, isAcceptanceRejectPending,
  trimmedAcceptanceRejectFeedback,
  logViews, logsLoading, logsError,
  normalizeDisplayText,
  taskExecutionMode,
  submitCancel, submitAcceptanceReject,
}: TaskDetailModalsProps) {
  const modalLogs = activeLogTrack === "operator" ? (logViews.operator.length ? logViews.operator : logViews.raw) : logViews.raw;
  
  return (
    <>
      <Modal
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={null}
        width={880}
        title={locale === "zh-CN" ? "任务日志" : "Task logs"}
      >
        <Space direction="vertical" size={16} className="full-width">
          {logsError ? (
            <Alert
              type="warning"
              showIcon
              message={locale === "zh-CN" ? "任务日志刷新失败" : "Task log refresh failed"}
              description={logsError}
            />
          ) : null}
          {logViews.hasStructuredOperatorLogs ? (
            <Segmented<LogTrack>
              block
              value={activeLogTrack}
              onChange={(value) => setActiveLogTrack(value)}
              options={[
                { label: `${getLogTrackLabel("operator", locale)} (${logViews.operator.length})`, value: "operator" },
                { label: `${getLogTrackLabel("raw", locale)} (${logViews.raw.length})`, value: "raw" },
              ]}
            />
          ) : null}
          <Typography.Text type="secondary">
            {getLogSummaryText(logViews, locale)}
          </Typography.Text>
          {modalLogs.length ? (
            <div className="task-log-modal-body">
              <List
                className="detail-list"
                dataSource={modalLogs}
                renderItem={(entry) => (
                  <List.Item key={`${entry.timestamp}-${entry.message}`}>
                    <Space direction="vertical" size={4} className="full-width task-log-entry">
                      <Typography.Text type="secondary">
                        {new Date(entry.timestamp).toLocaleString(locale)}
                      </Typography.Text>
                      <Typography.Text className="wrap-anywhere preserve-breaks task-log-full-message">
                        {normalizeDisplayText(entry.message)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          ) : logsLoading ? (
            <Spin spinning />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "暂无日志" : "No logs yet"} />
          )}
        </Space>
      </Modal>

      <Modal
        open={cancelConfirmOpen}
        title={locale === "zh-CN" ? "确认取消任务" : "Confirm cancellation"}
        onCancel={() => {
          if (!isCancelPending) {
            setCancelConfirmOpen(false);
          }
        }}
        footer={[
          <Button key="keep" onClick={() => setCancelConfirmOpen(false)} disabled={Boolean(isCancelPending)}>
            {locale === "zh-CN" ? "继续保留任务" : "Keep task"}
          </Button>,
          <Button key="cancel" danger type="primary" loading={Boolean(isCancelPending)} onClick={() => void submitCancel()}>
            {locale === "zh-CN" ? "确认取消" : "Confirm cancel"}
          </Button>,
        ]}
        maskClosable={!isCancelPending}
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="warning"
            showIcon
            message={
              locale === "zh-CN"
                ? "取消只会清理当前未发布任务的工作区和中间痕迹，不会回退已经发布的版本。"
                : "Cancellation only cleans up workspace artifacts for unpublished tasks. It does not roll back an already published release."
            }
            description={
              locale === "zh-CN"
                ? "确认后请不要重复点击；如果后台清理变慢，详情页会持续显示处理中。"
                : "Do not click again after confirming. If cleanup is slow, the detail view will keep showing the in-progress state."
            }
          />
          <Typography.Text>
            {locale === "zh-CN"
              ? "只有“成功”和“已取消”会被视为归档态。"
              : "Only succeeded and cancelled tasks are treated as archived."}
          </Typography.Text>
        </Space>
      </Modal>

      <Modal
        open={acceptanceRejectModalOpen}
        title={locale === "zh-CN" ? "填写返修反馈" : "Provide revision feedback"}
        onCancel={() => {
          if (!isAcceptanceRejectPending) {
            setAcceptanceRejectModalOpen(false);
            setAcceptanceRejectFeedback("");
          }
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAcceptanceRejectModalOpen(false);
              setAcceptanceRejectFeedback("");
            }}
            disabled={Boolean(isAcceptanceRejectPending)}
          >
            {locale === "zh-CN" ? "取消" : "Cancel"}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={Boolean(isAcceptanceRejectPending)}
            disabled={!trimmedAcceptanceRejectFeedback}
            onClick={() => void submitAcceptanceReject()}
          >
            {locale === "zh-CN" ? "提交返修" : "Send back for revision"}
          </Button>,
        ]}
        maskClosable={!isAcceptanceRejectPending}
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="warning"
            showIcon
            message={
              locale === "zh-CN"
                ? "请明确说明为什么当前交付不能验收，以及本轮优先要修什么。"
                : "Explain why the current delivery cannot be accepted and what should be fixed first."
            }
            description={
              taskExecutionMode === "orchestrated"
                ? (locale === "zh-CN"
                    ? "提交后项目流会直接进入返修步骤，不会停在待返修等你再次确认。"
                    : "Submitting this will queue a revision step immediately so the project flow can continue.")
                : (locale === "zh-CN"
                    ? "提交后系统会直接开始下一次处理；如果仍有需要你补充的信息，会再回到“待处理”。"
                    : "Submitting this will start the next handling round immediately. If more input is needed, the task will return to pending handling.")
            }
          />
          <Input.TextArea
            rows={6}
            value={acceptanceRejectFeedback}
            onChange={(event) => setAcceptanceRejectFeedback(event.target.value)}
            placeholder={
              locale === "zh-CN"
                ? "例如：页面虽已部署，但核心使用链路不可用；请先补齐可实际操作的最小闭环，并附操作说明。"
                : "Example: The page is deployed, but the core usage flow is still broken. Please fix the minimum usable flow and include validation steps."
            }
          />
          <Typography.Text type="secondary">
            {locale === "zh-CN"
              ? "返修反馈会直接作为任务的未完成原因保留下来。"
              : "The feedback will be stored as the task's open failure reason."}
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
}
