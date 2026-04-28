import { Button, Card, Checkbox, Divider, Empty, Flex, Space, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import { TaskDetail } from "./dashboardComponents";
import { ApprovalCard } from "./components/dashboardApprovalCard";
import { CreateDialog } from "./components/dashboardCreateDialog";
import { ListPagination } from "./components/dashboardMetricComponents";
import { SectionHeader } from "./components/dashboardHeaderComponents";
import { StatusFilterBar } from "./components/dashboardStatusFilter";
import {
  AUTO_ROUTE_PROJECT_ID,
  STATUS_FILTER_ALL,
  statusLabel,
  statusTagColor,
} from "./dashboardConstants";
import type { DashboardWorkspaceViewModel } from "./dashboardControlTypes";
import { buildLogViews } from "./dashboardLogs";
import { getRequirementPreview, normalizeDisplayText } from "./dashboardTaskViews";
import type { Requirement, Task } from "./dashboardTypes";

function getRequirementStatusSource(requirement: Requirement): Pick<Task, "status" | "planDraftPending" | "pendingAction" | "executionDecisionGate" | "pendingReason" | "pendingReasonLabel" | "userAction" | "planPreview"> {
  return requirement.attempts[0] || {
    status: requirement.status,
    planDraftPending: false,
    pendingAction: null,
    executionDecisionGate: null,
    pendingReason: null,
    pendingReasonLabel: "",
    userAction: null,
    planPreview: "",
  };
}

type WorkspaceMainPaneProps = {
  workspace: DashboardWorkspaceViewModel;
};

function isManualSyncInFlight(taskSyncState: DashboardWorkspaceViewModel["taskSyncState"]) {
  return taskSyncState.inFlight && taskSyncState.trigger !== "auto";
}

function WorkspaceMainPane({ workspace }: WorkspaceMainPaneProps) {
  const {
    locale,
    copy,
    workspaceLevel,
    breadcrumbs,
    workspaceTitle,
    workspaceDescription,
    createLabel,
    filteredProjects,
    paginatedSelectedProjectRequirements,
    filteredSelectedProjectRequirements,
    requirementPage,
    requirementPageSize,
    selectedTask,
    selectedRequirement,
    selectedTaskDetailLoading,
    selectedTaskDetailError,
    selectedTaskLogsLoading,
    selectedTaskLogsError,
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    taskSyncState,
    projectStatusFilter,
    requirementStatusFilter,
    showUnarchivedOnly,
    onProjectStatusFilterChange,
    onRequirementStatusFilterChange,
    onToggleShowUnarchivedOnly,
    onRequirementPageChange,
    onRefreshAll,
    onOpenCreateDialog,
    onOpenProject,
    onOpenRequirement,
    onMutateTask,
    onRespondToTask,
    onDismissAnomaly,
    getProjectDisplayName,
    getTaskDisplayedStatusText,
    getTaskDisplayedStatusColor,
  } = workspace;

  return (
    <Card className="pane-card workspace-main-card" bordered={false}>
      <Flex justify="space-between" gap={16} wrap className="workspace-toolbar">
        <div className="breadcrumb-row workspace-toolbar-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb) => (
            <Button
              key={crumb.key}
              type={crumb.active ? "primary" : "default"}
              onClick={crumb.onClick}
              className="breadcrumb-button"
              title={crumb.label}
            >
              {crumb.label}
            </Button>
          ))}
        </div>
        <Space wrap className="workspace-toolbar-actions">
          <Button icon={<ReloadOutlined />} loading={isManualSyncInFlight(taskSyncState)} onClick={() => void onRefreshAll()}>
            {copy.refresh}
          </Button>
          {workspaceLevel === "projects" ? (
            <Button onClick={() => onOpenCreateDialog("composite_task")}>
              {locale === "zh-CN" ? "模糊/组合任务" : "Composite task"}
            </Button>
          ) : null}
          {createLabel ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onOpenCreateDialog(workspaceLevel === "projects" ? "project" : "task")}
            >
              {createLabel}
            </Button>
          ) : null}
        </Space>
      </Flex>

      <SectionHeader
        title={workspaceTitle}
        subtitle={workspaceDescription}
        actions={
          workspaceLevel === "projects" || workspaceLevel === "tasks" ? (
            <Space wrap size={12}>
              <Checkbox checked={showUnarchivedOnly} onChange={(event) => onToggleShowUnarchivedOnly(event.target.checked)}>
                {locale === "zh-CN" ? "仅展示未归档任务" : "Only unarchived"}
              </Checkbox>
              <StatusFilterBar
                locale={locale}
                value={workspaceLevel === "projects" ? projectStatusFilter : requirementStatusFilter}
                onChange={workspaceLevel === "projects" ? onProjectStatusFilterChange : onRequirementStatusFilterChange}
                statusFilterAll={STATUS_FILTER_ALL}
                statusLabel={statusLabel}
              />
            </Space>
          ) : undefined
        }
      />

      {workspaceLevel === "projects" ? (
        filteredProjects.length ? (
          <div className="entity-grid">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                hoverable
                className="entity-card"
                onClick={() => onOpenProject(project.id)}
              >
                <Flex justify="space-between" align="flex-start" gap={12}>
                  <Space direction="vertical" size={6} className="full-width">
                    <Typography.Title level={5} className="card-title">
                      {getProjectDisplayName(project.id, locale, project.name)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {(project.id === AUTO_ROUTE_PROJECT_ID
                        ? locale === "zh-CN"
                          ? "模糊或跨项目任务暂存区，等待 AI 判断路由。"
                          : "Staging area for composite or cross-project tasks before AI routing."
                        : project.description) || (locale === "zh-CN" ? "暂无项目描述" : "No description")}
                    </Typography.Text>
                  </Space>
                  <Tag color="blue">
                    {project.taskStats.running + project.taskStats.waiting}/{project.taskStats.total}
                  </Tag>
                </Flex>
                <Divider />
                <Typography.Text type="secondary" className="wrap-anywhere">
                  {project.repository ? (
                    <a href={project.repository} target="_blank" rel="noreferrer">
                      {project.repository}
                    </a>
                  ) : (
                    locale === "zh-CN" ? "未绑定仓库" : "No repository"
                  )}
                </Typography.Text>
                {project.localRuntime?.enabled ? (
                  <>
                    <Divider />
                    <Space direction="vertical" size={4} className="full-width">
                      <Typography.Text type="secondary">
                        {locale === "zh-CN" ? "动态入口：" : "Dynamic route: "}
                        <Typography.Text code>{project.localRuntime.exposureBasePath || project.exposureRoute || `/projects/${project.id}`}</Typography.Text>
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {locale === "zh-CN" ? "自动接入：" : "Automation: "}
                        {project.localRuntime.status === "configured"
                          ? (locale === "zh-CN" ? "已配置" : "Configured")
                          : project.localRuntime.status === "failed"
                            ? (locale === "zh-CN" ? "失败" : "Failed")
                            : (locale === "zh-CN" ? "待本机 worker 同步" : "Waiting for local worker sync")}
                      </Typography.Text>
                    </Space>
                  </>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <Empty description={locale === "zh-CN" ? "当前筛选下暂无项目" : "No projects match this status filter"} />
        )
      ) : null}

      {workspaceLevel === "tasks" ? (
        filteredSelectedProjectRequirements.length ? (
          <div className="section-stack">
            <div className="entity-grid">
              {paginatedSelectedProjectRequirements.map((requirement) => {
                const requirementStatus = getRequirementStatusSource(requirement);
                return (
                  <Card
                    key={requirement.id}
                    hoverable
                    className="entity-card"
                    onClick={() => onOpenRequirement(requirement)}
                  >
                    <Space direction="vertical" size={10} className="full-width">
                      <Flex justify="space-between" align="flex-start" gap={12}>
                        <Typography.Title level={5} className="card-title clamp-2">
                          {requirement.title}
                        </Typography.Title>
                        <Tag color={getTaskDisplayedStatusColor(requirementStatus)}>
                          {getTaskDisplayedStatusText(requirementStatus, locale)}
                        </Tag>
                      </Flex>
                      <Typography.Text type="secondary">
                        {getProjectDisplayName(requirement.projectId, locale, requirement.projectName)} · attempt #
                        {requirement.latestAttemptNumber}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {locale === "zh-CN" ? "验收：" : "Acceptance: "}
                        {requirement.acceptanceCompleted}/{requirement.acceptanceTotal}
                        {requirement.publishStatus ? ` · ${requirement.publishStatus}` : ""}
                      </Typography.Text>
                      <Typography.Paragraph className="entity-preview" ellipsis={{ rows: 3 }}>
                        {getRequirementPreview(requirement, locale)}
                      </Typography.Paragraph>
                    </Space>
                  </Card>
                );
              })}
            </div>
            <ListPagination
              locale={locale}
              current={requirementPage}
              pageSize={requirementPageSize}
              total={filteredSelectedProjectRequirements.length}
              itemLabel={{ "zh-CN": "需求", "en-US": "requirements" }}
              onChange={onRequirementPageChange}
            />
          </div>
        ) : (
          <Empty description={locale === "zh-CN" ? "当前筛选下暂无需求" : "No requirements match this status filter"} />
        )
      ) : null}

      {workspaceLevel === "detail" ? (
        selectedTask && selectedRequirement ? (
          <TaskDetail
            requirement={selectedRequirement}
            task={selectedTask}
            locale={locale}
            detailLoading={selectedTaskDetailLoading}
            detailError={selectedTaskDetailError}
            logsLoading={selectedTaskLogsLoading}
            logsError={selectedTaskLogsError}
            onMutate={onMutateTask}
            onRespond={onRespondToTask}
            anomalies={selectedRequirementAnomalies}
            dismissedAnomalyIds={dismissedAnomalyIds}
            onDismissAnomaly={onDismissAnomaly}
            statusLabel={statusLabel}
            statusTagColor={statusTagColor}
            getProjectDisplayName={getProjectDisplayName}
            normalizeDisplayText={normalizeDisplayText}
            buildLogViews={buildLogViews}
          />
        ) : (
          <Empty description={copy.noTask} />
        )
      ) : null}
    </Card>
  );
}

type WorkspaceSidePaneProps = {
  workspace: DashboardWorkspaceViewModel;
};

function WorkspaceSidePane({ workspace }: WorkspaceSidePaneProps) {
  const {
    locale,
    copy,
    visibleWorkspaceAnomalies,
    visibleApprovals,
    visibleQueueItems,
    taskSyncState,
    onRefreshTasks,
    onOpenTaskRequirement,
    onDismissAnomaly,
    getProjectDisplayName,
  } = workspace;

  return (
    <div className="workspace-side">
      <Card className="pane-card" bordered={false}>
        <SectionHeader
          title={copy.pendingApprovals}
          actions={
            <Button icon={<ReloadOutlined />} loading={isManualSyncInFlight(taskSyncState)} onClick={() => void onRefreshTasks()}>
              {copy.refresh}
            </Button>
          }
        />
        <div className="section-stack">
          {visibleApprovals.length ? (
            visibleApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                locale={locale}
                onOpenTask={onOpenTaskRequirement}
                statusLabel={statusLabel}
                statusTagColor={statusTagColor}
                getProjectDisplayName={getProjectDisplayName}
              />
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={locale === "zh-CN" ? "当前没有待处理任务" : "No pending tasks"}
            />
          )}
        </div>
        <Divider />
        <SectionHeader title={locale === "zh-CN" ? "队列列表" : "Queue"} />
        <div className="section-stack">
          {visibleQueueItems.length ? (
            visibleQueueItems.map((item) => (
              <Card key={item.taskId} size="small" className="list-card">
                <Space direction="vertical" size={8} className="full-width">
                  <Flex justify="space-between" align="flex-start" gap={12}>
                    <Typography.Text strong className="wrap-anywhere">
                      #{item.position} · {item.title}
                    </Typography.Text>
                    <Tag color={statusTagColor[item.status]}>{statusLabel[item.status][locale]}</Tag>
                  </Flex>
                  <Typography.Text type="secondary" className="wrap-anywhere">
                    {getProjectDisplayName(item.projectId, locale, item.projectName)}
                    {item.queueName ? ` · ${item.queueName}` : ""}
                    {item.issueNumber ? ` · Issue #${item.issueNumber}` : ""}
                  </Typography.Text>
                  {item.summary ? (
                    <Typography.Paragraph className="entity-preview" ellipsis={{ rows: 2 }}>
                      {normalizeDisplayText(item.summary)}
                    </Typography.Paragraph>
                  ) : null}
                  <Button onClick={() => onOpenTaskRequirement(item.taskId)}>
                    {locale === "zh-CN" ? "打开任务" : "Open task"}
                  </Button>
                </Space>
              </Card>
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "当前队列为空" : "Queue is empty"} />
          )}
        </div>
        <Divider />
        <SectionHeader title={locale === "zh-CN" ? "异常队列" : "Anomaly queue"} />
        <div className="section-stack">
          {visibleWorkspaceAnomalies.length ? (
            visibleWorkspaceAnomalies.map((item) => (
              <Card key={item.id} size="small" className="list-card">
                <Space direction="vertical" size={10} className="full-width">
                  <Flex justify="space-between" align="flex-start" gap={12}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag color={statusTagColor[item.status]}>{statusLabel[item.status][locale]}</Tag>
                  </Flex>
                  <Typography.Text>{item.detail}</Typography.Text>
                  <Flex gap={8} wrap>
                    <Button onClick={() => onOpenTaskRequirement(item.taskId)}>
                      {locale === "zh-CN" ? "打开需求" : "Open requirement"}
                    </Button>
                    <Button type="primary" ghost onClick={() => onDismissAnomaly(item)}>
                      {locale === "zh-CN" ? "标记已处理" : "Mark handled"}
                    </Button>
                  </Flex>
                </Space>
              </Card>
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "zh-CN" ? "当前没有异常需求" : "No anomalies"} />
          )}
        </div>
      </Card>
    </div>
  );
}

type WorkspacePageProps = {
  workspace: DashboardWorkspaceViewModel;
};

export function WorkspacePage({ workspace }: WorkspacePageProps) {
  const { isMobile, createDialogMode, locale, visibleProjects, selectedProjectId, onCloseCreateDialog, onCreateProject, onCreateTask, getProjectDisplayName } = workspace;

  return (
    <>
      <div className={isMobile ? "workspace-layout" : "workspace-layout view-pane"}>
        <WorkspaceMainPane workspace={workspace} />
        <WorkspaceSidePane workspace={workspace} />
      </div>
      {createDialogMode ? (
        <CreateDialog
          locale={locale}
          mode={createDialogMode}
          projects={visibleProjects}
          selectedProjectId={selectedProjectId}
          closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
          onClose={onCloseCreateDialog}
          onCreateProject={onCreateProject}
          onCreateTask={onCreateTask}
          getProjectDisplayName={getProjectDisplayName}
        />
      ) : null}
    </>
  );
}
