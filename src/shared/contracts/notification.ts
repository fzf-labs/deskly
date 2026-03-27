export type NotificationUrgency = 'normal' | 'critical' | 'low'

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  silent?: boolean
  urgency?: NotificationUrgency
}

export interface NotificationSoundSettings {
  enabled?: boolean
  taskComplete?: boolean
  stageComplete?: boolean
  error?: boolean
}

export interface NotificationSoundSettingsState {
  enabled: boolean
  taskComplete: boolean
  stageComplete: boolean
  error: boolean
}
