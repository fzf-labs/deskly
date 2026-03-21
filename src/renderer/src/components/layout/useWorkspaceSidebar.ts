import { useCallback, useEffect, useMemo, useState } from 'react';

import { db, type Task } from '@/data';
import { useProjects } from '@/hooks/useProjects';

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
  kind: 'project' | 'unassigned';
}

const UNASSIGNED_GROUP_ID = '__unassigned__';

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

function sortTasksByUpdatedAt(tasks: WorkspaceTaskItem[]): WorkspaceTaskItem[] {
  return [...tasks].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export function useWorkspaceSidebar() {
  const {
    projects,
    currentProject,
    currentProjectId,
    loading: projectsLoading,
    error: projectsError,
    setCurrentProjectId,
  } = useProjects();
  const [tasks, setTasks] = useState<WorkspaceTaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setTasksLoading(true);
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
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const projectGroups = useMemo<WorkspaceProjectGroup[]>(() => {
    const grouped = new Map<string, WorkspaceTaskItem[]>();
    const unassignedTasks: WorkspaceTaskItem[] = [];

    for (const task of tasks) {
      if (task.projectId) {
        const currentTasks = grouped.get(task.projectId) ?? [];
        currentTasks.push(task);
        grouped.set(task.projectId, currentTasks);
        continue;
      }
      unassignedTasks.push(task);
    }

    const groups: WorkspaceProjectGroup[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      tasks: sortTasksByUpdatedAt(grouped.get(project.id) ?? []),
      isCurrent: currentProjectId === project.id,
      kind: 'project' as const,
    }));

    if (unassignedTasks.length > 0) {
      groups.push({
        id: UNASSIGNED_GROUP_ID,
        name: 'Unassigned',
        tasks: sortTasksByUpdatedAt(unassignedTasks),
        isCurrent: currentProjectId === null,
        kind: 'unassigned',
      });
    }

    return groups;
  }, [currentProjectId, projects, tasks]);

  return {
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
