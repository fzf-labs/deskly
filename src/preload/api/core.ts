import { IPC_CHANNELS } from '../../main/ipc/channels'
import type {
  CheckProjectPathResult,
  CreateProjectOptions,
  Project
} from '../../shared/contracts/project'
import type { AppSettings } from '../../shared/contracts/settings'
import { invoke } from './common'

export const coreApi = {
  projects: {
    getAll: (): Promise<Project[]> => invoke(IPC_CHANNELS.projects.getAll),
    get: (id: string): Promise<Project | undefined> => invoke(IPC_CHANNELS.projects.get, id),
    add: (project: CreateProjectOptions): Promise<Project> =>
      invoke(IPC_CHANNELS.projects.add, project),
    update: (id: string, updates: Partial<Project>): Promise<Project | null> =>
      invoke(IPC_CHANNELS.projects.update, id, updates),
    delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.projects.delete, id),
    checkPath: (id: string): Promise<CheckProjectPathResult> =>
      invoke(IPC_CHANNELS.projects.checkPath, id)
  },
  app: {
    getVersion: (): Promise<string> => invoke(IPC_CHANNELS.app.getVersion)
  },
  settings: {
    get: (): Promise<AppSettings> => invoke(IPC_CHANNELS.settings.get),
    update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
      invoke(IPC_CHANNELS.settings.update, updates),
    reset: (): Promise<AppSettings> => invoke(IPC_CHANNELS.settings.reset)
  }
}
