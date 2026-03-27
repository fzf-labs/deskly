import type { EnabledCliTools } from '../agent-cli-tool-enablement'

export interface AppSettings {
  enabledCliTools: EnabledCliTools
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    enabled: boolean
    sound: boolean
  }
}
