export const TASKS_CHANGED_EVENT = 'tasks:changed'

export function notifyTasksChanged(): void {
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT))
}
