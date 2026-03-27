import { IPC_CHANNELS } from '../../main/ipc/channels'
import type {
  FileEntry,
  FileStat,
  OpenDialogOptions,
  SaveDialogOptions
} from '../../shared/contracts/system'
import { invoke } from './common'

export const systemApi = {
  fs: {
    readFile: (path: string): Promise<Uint8Array> => invoke(IPC_CHANNELS.fs.readFile, path),
    readTextFile: (path: string): Promise<string> => invoke(IPC_CHANNELS.fs.readTextFile, path),
    writeFile: (path: string, data: Uint8Array | string): Promise<void> =>
      invoke(IPC_CHANNELS.fs.writeFile, path, data),
    writeTextFile: (path: string, content: string): Promise<void> =>
      invoke(IPC_CHANNELS.fs.writeTextFile, path, content),
    appendTextFile: (path: string, content: string): Promise<void> =>
      invoke(IPC_CHANNELS.fs.appendTextFile, path, content),
    stat: (path: string): Promise<FileStat> => invoke(IPC_CHANNELS.fs.stat, path),
    readDir: (path: string, options?: { maxDepth?: number }): Promise<FileEntry[]> =>
      invoke(IPC_CHANNELS.fs.readDir, path, options),
    exists: (path: string): Promise<boolean> => invoke(IPC_CHANNELS.fs.exists, path),
    remove: (path: string, options?: { recursive?: boolean }): Promise<void> =>
      invoke(IPC_CHANNELS.fs.remove, path, options),
    mkdir: (path: string): Promise<void> => invoke(IPC_CHANNELS.fs.mkdir, path)
  },
  dialog: {
    save: (options: SaveDialogOptions): Promise<string | null> =>
      invoke(IPC_CHANNELS.dialog.save, options),
    open: (options: OpenDialogOptions): Promise<string | string[] | null> =>
      invoke(IPC_CHANNELS.dialog.open, options)
  },
  shell: {
    openUrl: (url: string): Promise<void> => invoke(IPC_CHANNELS.shell.openUrl, url),
    openPath: (path: string): Promise<void> => invoke(IPC_CHANNELS.shell.openPath, path),
    showItemInFolder: (path: string): Promise<void> =>
      invoke(IPC_CHANNELS.shell.showItemInFolder, path)
  },
  path: {
    appConfigDir: (): Promise<string> => invoke(IPC_CHANNELS.path.appConfigDir),
    tempDir: (): Promise<string> => invoke(IPC_CHANNELS.path.tempDir),
    resourcesDir: (): Promise<string> => invoke(IPC_CHANNELS.path.resourcesDir),
    appPath: (): Promise<string> => invoke(IPC_CHANNELS.path.appPath),
    desklyDataDir: (): Promise<string> => invoke(IPC_CHANNELS.path.desklyDataDir),
    homeDir: (): Promise<string> => invoke(IPC_CHANNELS.path.homeDir)
  }
}
