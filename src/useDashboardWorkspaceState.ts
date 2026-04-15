import { useEffect, useMemo } from "react";

import { REQUIREMENT_PAGE_SIZE_DESKTOP, REQUIREMENT_PAGE_SIZE_MOBILE, STATUS_FILTER_ALL } from "./dashboardConstants";
import type { DashboardBreadcrumb, PendingTaskMutation } from "./dashboardControlTypes";
import {
  applyPendingMutationsToTasks,
  buildPendingPlaceholderTasks,
  buildTaskLookupKey,
  taskNeedsUserAttention,
} from "./dashboardPendingMutations";
import { getProjectDisplayName, matchesStatusFilter, mergeProjectStats } from "./dashboardProjectUtils";
import { buildRequirementsFromTasks, getRequirementAnomalies } from "./dashboardTaskViews";
import type {
  Approval,
  DismissedAnomaly,
  Locale,
  Project,
  Requirement,
  RuntimeMode,
  StatusFilterValue,
  Task,
  WorkspaceAnomaly,
  WorkspaceLevel,
} from "./dashboardTypes";

type UseDashboardWorkspaceStateInput = {
  runtimeMode: RuntimeMode;
  locale: Locale;
  isMobile: boolean;
  projects: Project[];
  tasks: Task[];
  pendingTaskMutations: Record<string, PendingTaskMutation>;
  approvals: Approval[];
  dismissedAnomalies: DismissedAnomaly[];
  selectedTaskId: string;
  selectedRequirementId: string;
  selectedProjectId: string;
  workspaceLevel: WorkspaceLevel;
  projectStatusFilter: StatusFilterValue;
  requirementStatusFilter: StatusFilterValue;
  requirementPage: number;
  setSelectedTaskId: (next: string) => void;
  setSelectedRequirementId: (next: string) => void;
  setSelectedProjectId: (next: string) => void;
  setWorkspaceLevel: (next: WorkspaceLevel) => void;
  setRequirementStatusFilter: (next: StatusFilterValue) => void;
  setRequirementPage: (next: number) => void;
  detailTitle: string;
};

export function useDashboardWorkspaceState(input: UseDashboardWorkspaceStateInput) {
  const {
    runtimeMode,
    locale,
    isMobile,
    projects,
    tasks,
    pendingTaskMutations,
    approvals,
    dismissedAnomalies,
    selectedTaskId,
    selectedRequirementId,
    selectedProjectId,
    workspaceLevel,
    projectStatusFilter,
    requirementStatusFilter,
    requirementPage,
    setSelectedTaskId,
    setSelectedRequirementId,
    setSelectedProjectId,
    setWorkspaceLevel,
    setRequirementStatusFilter,
    setRequirementPage,
    detailTitle,
  } = input;

  const requirementPageSize = isMobile ? REQUIREMENT_PAGE_SIZE_MOBILE : REQUIREMENT_PAGE_SIZE_DESKTOP;

  const remoteTasksWithPending = useMemo(
    () => applyPendingMutationsToTasks(tasks, pendingTaskMutations, locale),
    [locale, pendingTaskMutations, tasks],
  );

  const visibleTasks = useMemo(() => {
    const pendingPlaceholders = buildPendingPlaceholderTasks(pendingTaskMutations, locale);
    if (!pendingPlaceholders.length) {
      return remoteTasksWithPending;
    }
    const resolvedIssueNumbers = new Set(
      remoteTasksWithPending.map((task) => task.issueNumber).filter((value): value is number => typeof value === "number"),
    );
    const resolvedKeys = new Set(remoteTasksWithPending.map((task) => buildTaskLookupKey(task)));
    const pendingOnly = pendingPlaceholders.filter((task) => {
      if (typeof task.issueNumber === "number" && resolvedIssueNumbers.has(task.issueNumber)) {
        return false;
      }
      return !resolvedKeys.has(buildTaskLookupKey(task));
    });
    return [...pendingOnly, ...remoteTasksWithPending];
  }, [locale, pendingTaskMutations, remoteTasksWithPending]);

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, visibleTasks],
  );

  const visibleRequirements = useMemo(
    () => buildRequirementsFromTasks(visibleTasks),
    [visibleTasks],
  );

  const selectedRequirement = useMemo(
    () => visibleRequirements.find((requirement) => requirement.id === selectedRequirementId) ?? null,
    [selectedRequirementId, visibleRequirements],
  );

  const workspaceAnomalies = useMemo(
    () => visibleRequirements.flatMap((requirement) => getRequirementAnomalies(requirement, locale)),
    [locale, visibleRequirements],
  );

  const dismissedAnomalyIds = useMemo(
    () => new Set(dismissedAnomalies.map((item) => item.id)),
    [dismissedAnomalies],
  );

  const visibleWorkspaceAnomalies = useMemo(
    () => workspaceAnomalies.filter((item) => !dismissedAnomalyIds.has(item.id)),
    [dismissedAnomalyIds, workspaceAnomalies],
  );

  const selectedRequirementAnomalies = useMemo(
    () => (selectedRequirement ? getRequirementAnomalies(selectedRequirement, locale) : []),
    [locale, selectedRequirement],
  );

  const visibleProjects = useMemo(
    () => mergeProjectStats(projects, visibleTasks),
    [projects, visibleTasks],
  );

  const visibleApprovals = useMemo(() => {
    const visibleTaskById = new Map(visibleTasks.map((task) => [task.id, task]));
    const remoteApprovals = approvals
      .map((approval) => {
        const task = visibleTaskById.get(approval.task.id) || approval.task;
        return {
          ...approval,
          task,
          reason: task.userAction?.title || approval.reason,
        };
      })
      .filter((approval) => taskNeedsUserAttention(approval.task));
    const knownTaskIds = new Set(remoteApprovals.map((approval) => approval.task.id));
    const derivedApprovals = visibleTasks
      .filter((task) => taskNeedsUserAttention(task) && !knownTaskIds.has(task.id))
      .map((task) => ({
        id: `approval-${task.issueNumber || task.id}`,
        reason:
          task.userAction?.title ||
          (locale === "zh-CN" ? "请在详情页确认后继续执行" : "Review this task in detail before continuing"),
        task,
      }));
    return [...remoteApprovals, ...derivedApprovals].sort(
      (left, right) => Date.parse(right.task.updatedAt || "") - Date.parse(left.task.updatedAt || ""),
    );
  }, [approvals, locale, visibleTasks]);

  const filteredProjects = useMemo(
    () =>
      visibleProjects.filter(
        (project) =>
          projectStatusFilter === STATUS_FILTER_ALL
          || visibleRequirements.some(
            (requirement) => requirement.projectId === project.id && matchesStatusFilter(requirement.status, projectStatusFilter),
          ),
      ),
    [projectStatusFilter, visibleProjects, visibleRequirements],
  );

  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === selectedProjectId) ?? null,
    [selectedProjectId, visibleProjects],
  );

  const selectedProjectRequirements = useMemo(
    () => visibleRequirements.filter((requirement) => requirement.projectId === selectedProjectId),
    [selectedProjectId, visibleRequirements],
  );

  const filteredSelectedProjectRequirements = useMemo(
    () => selectedProjectRequirements.filter((requirement) => matchesStatusFilter(requirement.status, requirementStatusFilter)),
    [requirementStatusFilter, selectedProjectRequirements],
  );

  const paginatedSelectedProjectRequirements = useMemo(() => {
    const startIndex = (requirementPage - 1) * requirementPageSize;
    return filteredSelectedProjectRequirements.slice(startIndex, startIndex + requirementPageSize);
  }, [filteredSelectedProjectRequirements, requirementPage, requirementPageSize]);

  useEffect(() => {
    if (!visibleProjects.length) {
      setSelectedProjectId("");
      setSelectedRequirementId("");
      setSelectedTaskId("");
      setWorkspaceLevel("projects");
      return;
    }

    if (!selectedProjectId) return;

    if (!visibleProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(visibleProjects[0].id);
      setWorkspaceLevel("projects");
    }
  }, [selectedProjectId, setSelectedProjectId, setSelectedRequirementId, setSelectedTaskId, setWorkspaceLevel, visibleProjects]);

  useEffect(() => {
    if (!visibleRequirements.length) {
      setSelectedRequirementId("");
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (!selectedRequirementId) return;

    const nextRequirement = visibleRequirements.find((requirement) => requirement.id === selectedRequirementId);
    if (!nextRequirement) {
      setSelectedRequirementId("");
      setSelectedTaskId("");
      if (workspaceLevel === "detail") setWorkspaceLevel("tasks");
      return;
    }

    if (nextRequirement.projectId !== selectedProjectId) {
      setSelectedProjectId(nextRequirement.projectId);
    }
    if (nextRequirement.latestAttemptId !== selectedTaskId) {
      setSelectedTaskId(nextRequirement.latestAttemptId);
    }
  }, [
    selectedProjectId,
    selectedRequirementId,
    selectedTaskId,
    setSelectedProjectId,
    setSelectedRequirementId,
    setSelectedTaskId,
    setWorkspaceLevel,
    visibleRequirements,
    workspaceLevel,
  ]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSelectedProjectRequirements.length / requirementPageSize));
    if (requirementPage > totalPages) {
      setRequirementPage(totalPages);
    }
  }, [filteredSelectedProjectRequirements.length, requirementPage, requirementPageSize, setRequirementPage]);

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedRequirementId("");
    setRequirementPage(1);
    setWorkspaceLevel("tasks");
  }

  function openRequirement(requirement: Requirement) {
    const requirementIndex = visibleRequirements
      .filter(
        (candidate) => candidate.projectId === requirement.projectId && matchesStatusFilter(candidate.status, requirementStatusFilter),
      )
      .findIndex((candidate) => candidate.id === requirement.id);

    if (requirementIndex >= 0) {
      setRequirementPage(Math.floor(requirementIndex / requirementPageSize) + 1);
    }
    setSelectedProjectId(requirement.projectId);
    setSelectedRequirementId(requirement.id);
    setSelectedTaskId(requirement.latestAttemptId);
    setWorkspaceLevel("detail");
  }

  function openTaskRequirement(taskId: string) {
    const task = visibleTasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    const requirement = visibleRequirements.find(
      (candidate) => candidate.latestAttemptId === task.id || candidate.attempts.some((attempt) => attempt.id === task.id),
    );
    if (!requirement) return;
    openRequirement(requirement);
  }

  function handleRequirementStatusFilterChange(next: StatusFilterValue) {
    setRequirementStatusFilter(next);
    setRequirementPage(1);
  }

  const breadcrumbs = [
    {
      key: "projects",
      label: locale === "zh-CN" ? "项目" : "Projects",
      active: workspaceLevel === "projects",
      onClick: () => setWorkspaceLevel("projects"),
    },
    ...(selectedProject
      ? [{
          key: "tasks",
          label: getProjectDisplayName(selectedProject.id, locale, selectedProject.name),
          active: workspaceLevel === "tasks",
          onClick: () => {
            setSelectedProjectId(selectedProject.id);
            setWorkspaceLevel("tasks");
          },
        }]
      : []),
    ...(selectedRequirement
      ? [{
          key: "detail",
          label: selectedRequirement.title,
          active: workspaceLevel === "detail",
          onClick: () => {
            openRequirement(selectedRequirement);
          },
        }]
      : []),
  ] satisfies DashboardBreadcrumb[];

  const workspaceTitle =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "项目列表"
        : "Projects"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "需求列表"
          : "Requirements"
        : detailTitle;

  const workspaceDescription =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "先选择项目，再进入对应任务列表。"
        : "Choose a project first, then inspect its tasks."
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? `${getProjectDisplayName(selectedProject?.id || "", locale, selectedProject?.name) || "当前项目"} 下的需求线程`
          : `Requirement threads under ${getProjectDisplayName(selectedProject?.id || "", locale, selectedProject?.name) || "the current project"}`
        : locale === "zh-CN"
          ? "展示当前需求线程的最新 attempt、验收项和失败原因。"
          : "Focused detail view for the active requirement, including attempts and acceptance.";

  const createLabel =
    workspaceLevel === "projects"
      ? locale === "zh-CN"
        ? "新建项目"
        : "New project"
      : workspaceLevel === "tasks"
        ? locale === "zh-CN"
          ? "新建任务"
          : "New task"
        : "";

  return {
    requirementPageSize,
    visibleTasks,
    visibleRequirements,
    selectedTask,
    selectedRequirement,
    selectedRequirementAnomalies,
    dismissedAnomalyIds,
    visibleWorkspaceAnomalies,
    visibleProjects,
    visibleApprovals,
    filteredProjects,
    filteredSelectedProjectRequirements,
    paginatedSelectedProjectRequirements,
    breadcrumbs,
    workspaceTitle,
    workspaceDescription,
    createLabel,
    openProject,
    openRequirement,
    openTaskRequirement,
    handleRequirementStatusFilterChange,
  };
}
