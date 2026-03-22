// Settings module - unified exports

// Types
export type {
  AIProvider,
  MCPServer,
  SandboxProviderType,
  SandboxProviderSetting,
  AgentRuntimeType,
  AgentRuntimeSetting,
  UserProfile,
  EditorType,
  EditorSettings,
  EnabledCliTools,
  Settings,
  SoundChoice,
  SoundPresetId,
  SupportedCliToolId,
} from './types';

// General - core functions, theme
export {
  // Default values
  defaultSandboxProviders,
  defaultAgentRuntimes,
  defaultProviders,
  defaultSettings,
  getEnabledDefaultCliToolId,
  // Core functions
  getSettings,
  getSettingsAsync,
  isCliToolEnabledInSettings,
  saveSettings,
  saveSettingItem,
  initializeSettings,
  clearSettingsCache,
  clearAllSettings,
  // Internal functions (used by syncSettingsWithBackend)
  getDefaultAIProvider,
  getDefaultSandboxProvider,
  getDefaultAgentRuntime,
  // Sync
  syncSettingsWithBackend,
} from './general';

// Account
export { updateProfile, getProfile } from './account';

// MCP
export { updateMcpSettings, getMcpSettings } from './mcp';

// Skills
export { updateSkillsSettings, getSkillsSettings } from './skills';
