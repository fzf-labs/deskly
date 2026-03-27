import type { IpcModuleContext } from './types'
import type { AppSettings } from '../../shared/contracts/settings'
import { IPC_CHANNELS } from './channels'

export const registerSettingsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { settingsService } = services

  handle(IPC_CHANNELS.settings.get, [], () => settingsService.getSettings())
  handle(IPC_CHANNELS.settings.update, [v.object()], (_, updates) =>
    settingsService.updateSettings(updates as Partial<AppSettings>)
  )
  handle(IPC_CHANNELS.settings.reset, [], () => settingsService.resetSettings())
}
