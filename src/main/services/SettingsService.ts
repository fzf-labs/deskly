import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getAppPaths } from '../app/AppPaths'
import {
  createDefaultEnabledCliTools,
  normalizeEnabledCliTools
} from '../../shared/agent-cli-tool-enablement'
import type { AppSettings } from '../../shared/contracts/settings'

const DEFAULT_SETTINGS: AppSettings = {
  enabledCliTools: createDefaultEnabledCliTools(),
  theme: 'system',
  language: 'zh-CN',
  notifications: {
    enabled: true,
    sound: true
  }
}

export class SettingsService {
  private settingsFile: string
  private settings: AppSettings

  constructor() {
    const appPaths = getAppPaths()
    this.settingsFile = appPaths.getSettingsFile()
    this.settings = this.loadSettings()
  }

  private loadSettings(): AppSettings {
    try {
      if (existsSync(this.settingsFile)) {
        const data = readFileSync(this.settingsFile, 'utf-8')
        const loaded = JSON.parse(data)
        const {
          accentColor: _accentColor,
          backgroundStyle: _backgroundStyle,
          recommendedSystemCliToolIds: _recommendedSystemCliToolIds,
          ...rest
        } =
          loaded as Record<string, unknown>
        return {
          ...DEFAULT_SETTINGS,
          ...rest,
          enabledCliTools: normalizeEnabledCliTools(rest.enabledCliTools)
        }
      }
    } catch (error) {
      console.error('[SettingsService] Failed to load settings:', error)
    }
    return { ...DEFAULT_SETTINGS }
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2))
    } catch (error) {
      console.error('[SettingsService] Failed to save settings:', error)
    }
  }

  getSettings(): AppSettings {
    return {
      ...this.settings,
      enabledCliTools: normalizeEnabledCliTools(this.settings.enabledCliTools)
    }
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...updates,
      enabledCliTools: normalizeEnabledCliTools(
        updates.enabledCliTools ?? this.settings.enabledCliTools
      )
    }
    this.saveSettings()
    return this.getSettings()
  }

  resetSettings(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
    return this.getSettings()
  }
}
