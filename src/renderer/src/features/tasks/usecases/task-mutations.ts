import { db, type Task, type UpdateTaskInput } from '@/data'
import { notifyTasksChanged } from '@/lib/task-events'
import type { CreateTaskOptions, TaskWithWorktree } from '@shared/contracts/task'

import {
  notifyTaskCompleted,
  notifyTaskNeedsReview,
  playTaskReviewSound
} from '@features/notifications'

export async function createTaskWithSideEffects(
  input: CreateTaskOptions
): Promise<TaskWithWorktree> {
  const createdTask = (await window.api.task.create(input)) as TaskWithWorktree
  notifyTasksChanged()
  return createdTask
}

export async function updateTaskWithSideEffects(
  id: string,
  updates: UpdateTaskInput
): Promise<Task | null> {
  const updatedTask = await db.updateTask(id, updates)
  if (!updatedTask) {
    return updatedTask
  }

  if (updates.status === 'done' && updatedTask.status === 'done') {
    const taskTitle = updatedTask.title || updatedTask.prompt || undefined
    void notifyTaskCompleted(taskTitle)
  }

  if (updates.status === 'in_review' && updatedTask.status === 'in_review') {
    const taskTitle = updatedTask.title || updatedTask.prompt || undefined
    void notifyTaskNeedsReview(taskTitle)
    void playTaskReviewSound()
  }

  notifyTasksChanged()
  return updatedTask
}

export async function deleteTaskWithSideEffects(
  id: string,
  removeWorktree: boolean = true
): Promise<boolean> {
  const deleted = await db.deleteTask(id, removeWorktree)
  if (deleted) {
    notifyTasksChanged()
  }
  return deleted
}
