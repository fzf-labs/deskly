import { useCallback, useEffect, useMemo, useState } from 'react';

import { db, type Task } from '@/data';
import { useProjects } from '@features/projects';
import { TASKS_CHANGED_EVENT } from '@features/tasks';

export interface WorkspaceTaskItem {
  id: string;
  title: string;
  prompt: string;
  status: Task['status'];
  projectId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface WorkspaceProjectGroup {
  id: string;
  name: string;
  tasks: WorkspaceTaskItem[];
  isCurrent: boolean;
  kind: 'project';
}

export type WorkspaceSidebarSortMode = 'recent' | 'title';

interface RefreshWorkspaceSidebarOptions {
  silent?: boolean;
}

function toTaskItem(task: Task): WorkspaceTaskItem {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    status: task.status,
    projectId: task.project_id ?? null,
    updatedAt: task.updated_at,
    createdAt: task.created_at,
  };
}

function compareTaskUpdatedAt(left: WorkspaceTaskItem, right: WorkspaceTaskItem) {
  const leftTime = new Date(left.updatedAt).getTime();
  const rightTime = new Date(right.updatedAt).getTime();
  return rightTime - leftTime;
}

function compareTaskTitle(left: WorkspaceTaskItem, right: WorkspaceTaskItem) {
  return (
    left.title.localeCompare(right.title, undefined, {
      numeric: true,
      sensitivity: 'base',
    }) || compareTaskUpdatedAt(left, right)
  );
}

function sortTasks(
  tasks: WorkspaceTaskItem[],
  sortMode: WorkspaceSidebarSortMode
): WorkspaceTaskItem[] {
  return [...tasks].sort(
    sortMode === 'title' ? compareTaskTitle : compareTaskUpdatedAt
  );
}

function latestTaskTimestamp(tasks: WorkspaceTaskItem[]) {
  return tasks.reduce((latest, task) => {
    const timestamp = new Date(task.updatedAt).getTime();
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function compareGroupName(left: WorkspaceProjectGroup, right: WorkspaceProjectGroup) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortGroups(
  groups: WorkspaceProjectGroup[],
  sortMode: WorkspaceSidebarSortMode
): WorkspaceProjectGroup[] {
  return [...groups].sort((left, right) => {
    if (sortMode === 'title') {
      return compareGroupName(left, right);
    }

    const recentDifference =
      latestTaskTimestamp(right.tasks) - latestTaskTimestamp(left.tasks);

    return recentDifference || compareGroupName(left, right);
  });
}

export function useWorkspaceSidebar(
  sortMode: WorkspaceSidebarSortMode = 'recent'
) {
  const {
    projects,
    currentProject,
    currentProjectId,
    loading: projectsLoading,
    error: projectsError,
    setCurrentProjectId,
    addProject,
  } = useProjects();
  const [tasks, setTasks] = useState<WorkspaceTaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const refresh = useCallback(async (options: RefreshWorkspaceSidebarOptions = {}) => {
    if (!options.silent) {
      setTasksLoading(true);
    }

    try {
      const nextTasks = await db.getAllTasks();
      setTasks(Array.isArray(nextTasks) ? nextTasks.map(toTaskItem) : []);
      setTasksError(null);
    } catch (error) {
      console.error('[useWorkspaceSidebar] Failed to load tasks:', error);
      setTasks([]);
      setTasksError(
        error instanceof Error ? error.message : 'Failed to load tasks'
      );
    } finally {
      if (!options.silent) {
        setTasksLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleTasksChanged = () => {
      void refresh({ silent: true });
    };

    window.addEventListener(TASKS_CHANGED_EVENT, handleTasksChanged);
    return () => {
      window.removeEventListener(TASKS_CHANGED_EVENT, handleTasksChanged);
    };
  }, [refresh]);

  const projectGroups = useMemo<WorkspaceProjectGroup[]>(() => {
    const grouped = new Map<string, WorkspaceTaskItem[]>();

    for (const task of tasks) {
      if (task.projectId) {
        const currentTasks = grouped.get(task.projectId) ?? [];
        currentTasks.push(task);
        grouped.set(task.projectId, currentTasks);
      }
    }

    const groups: WorkspaceProjectGroup[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      tasks: sortTasks(grouped.get(project.id) ?? [], sortMode),
      isCurrent: currentProjectId === project.id,
      kind: 'project' as const,
    }));

    return sortGroups(groups, sortMode);
  }, [currentProjectId, projects, sortMode, tasks]);

  return {
    addProject,
    currentProject,
    currentProjectId,
    projects,
    projectGroups,
    loading: projectsLoading || tasksLoading,
    error: projectsError || tasksError,
    refresh,
    setCurrentProjectId,
  };
}
