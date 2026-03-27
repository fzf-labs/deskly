export interface BackgroundTask {
  taskId: string
  sessionId: string
  abortController: AbortController
  isRunning: boolean
  startedAt: Date
  prompt: string
}

type BackgroundTaskListener = (tasks: BackgroundTask[]) => void

const backgroundTasks = new Map<string, BackgroundTask>()
const listeners = new Set<BackgroundTaskListener>()

function notifyListeners() {
  const tasks = Array.from(backgroundTasks.values())
  listeners.forEach((listener) => listener(tasks))
}

export function addBackgroundTask(task: Omit<BackgroundTask, 'startedAt'>): void {
  backgroundTasks.set(task.taskId, {
    ...task,
    startedAt: new Date()
  })
  notifyListeners()
}

export function removeBackgroundTask(taskId: string): void {
  backgroundTasks.delete(taskId)
  notifyListeners()
}

export function getBackgroundTask(taskId: string): BackgroundTask | undefined {
  return backgroundTasks.get(taskId)
}

export function getAllBackgroundTasks(): BackgroundTask[] {
  return Array.from(backgroundTasks.values())
}

export function getRunningTaskCount(): number {
  return Array.from(backgroundTasks.values()).filter((task) => task.isRunning).length
}

export function updateBackgroundTaskStatus(taskId: string, isRunning: boolean): void {
  const task = backgroundTasks.get(taskId)
  if (!task) {
    return
  }

  task.isRunning = isRunning
  if (!isRunning) {
    window.setTimeout(() => {
      removeBackgroundTask(taskId)
    }, 1000)
  }
  notifyListeners()
}

export function isTaskRunningInBackground(taskId: string): boolean {
  return backgroundTasks.get(taskId)?.isRunning ?? false
}

export function stopBackgroundTask(taskId: string): void {
  const task = backgroundTasks.get(taskId)
  if (!task) {
    return
  }

  task.abortController.abort()
  task.isRunning = false
  removeBackgroundTask(taskId)
}

export function subscribeToBackgroundTasks(listener: BackgroundTaskListener): () => void {
  listeners.add(listener)
  listener(getAllBackgroundTasks())

  return () => {
    listeners.delete(listener)
  }
}

export function clearAllBackgroundTasks(): void {
  backgroundTasks.forEach((task) => {
    task.abortController.abort()
  })
  backgroundTasks.clear()
  notifyListeners()
}
