import { Button, Card, Divider, Empty, Flex, Space, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import {
  ApprovalCard,
  CreateDialog,
  ListPagination,
  SectionHeader,
  StatusFilterBar,
  TaskDetail,
} from "./dashboardComponents";
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

function formatTaskSyncStatus(
  taskSyncState: DashboardWorkspaceViewModel["taskSyncState"],
  locale: DashboardWorkspaceViewModel["locale"],
) {
  if (taskSyncState.inFlight) {
    return locale === "zh-CN" ? "正在同步…" : "Syncing...";
  }
  if (!taskSyncState.lastSyncedAt) {
    return locale === "zh-CN" ? "尚未同步" : "Not synced yet";
  }
  return locale === "zh-CN"
    ? `最近同步 ${new Date(taskSyncState.lastSyncedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : `Last synced ${new Date(taskSyncState.lastSyncedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function getRequirementStatusSource(requirement: Requirement): Pick<Task, "status" | "planDraftPending" | "pendingAction" | "executionDecisionGate"> {
  return requirement.attempts[0] || {
    status: requirement.status,
    planDraftPending: false,
    pendingAction: null,
    executionDecisionGate: null,
  };
}

type WorkspaceMainPaneProps = {
  workspace: DashboardWorkspaceViewModel;
};

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
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    taskSyncState,
    projectStatusFilter,
    requirementStatusFilter,
    onProjectStatusFilterChange,
    onRequirementStatusFilterChange,
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
          <Typography.Text type="secondary">{formatTaskSyncStatus(taskSyncState, locale)}</Typography.Text>
          <Button icon={<ReloadOutlined />} loading={taskSyncState.inFlight} onClick={() => void onRefreshAll()}>
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
          workspaceLevel === "projects" ? (
            <StatusFilterBar
              locale={locale}
              value={projectStatusFilter}
              onChange={onProjectStatusFilterChange}
              statusFilterAll={STATUS_FILTER_ALL}
              statusLabel={statusLabel}
            />
          ) : workspaceLevel === "tasks" ? (
            <StatusFilterBar
              locale={locale}
              value={requirementStatusFilter}
              onChange={onRequirementStatusFilterChange}
              statusFilterAll={STATUS_FILTER_ALL}
              statusLabel={statusLabel}
            />
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
                    {project.taskStats.running}/{project.taskStats.total}
                  </Tag>
                </Flex>
                <Divider />
                <Typography.Text type="secondary" className="wrap-anywhere">
                  {project.repository || (locale === "zh-CN" ? "未绑定仓库" : "No repository")}
                </Typography.Text>
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
            <Button icon={<ReloadOutlined />} loading={taskSyncState.inFlight} onClick={() => void onRefreshTasks()}>
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
              description={locale === "zh-CN" ? "当前没有待审批" : "No pending approvals"}
            />
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
