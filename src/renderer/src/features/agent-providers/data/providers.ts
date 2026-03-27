/**
 * Provider settings adapter.
 *
 * Keeps provider state in renderer settings and mirrors it to the main process
 * through IPC so the desktop app no longer depends on the legacy local HTTP API.
 */

import {
  getSettings,
  saveSettings,
  type AgentRuntimeSetting,
  type SandboxProviderSetting,
  type Settings,
} from '@/data/settings';

// ============================================================================
// Types
// ============================================================================

export interface ProviderMetadata {
  type: string;
  name: string;
  version: string;
  description: string;
  configSchema: Record<string, unknown>;
  icon?: string;
  docsUrl?: string;
  builtin?: boolean;
  tags?: string[];
  available?: boolean;
  current?: boolean;
}

export interface SandboxProviderMetadata extends ProviderMetadata {
  isolation: 'vm' | 'container' | 'process' | 'none';
  supportedRuntimes: string[];
  supportsVolumeMounts: boolean;
  supportsNetworking: boolean;
  supportsPooling: boolean;
}

export interface AgentProviderMetadata extends ProviderMetadata {
  supportsPlan: boolean;
  supportsStreaming: boolean;
  supportsSandbox: boolean;
  supportedModels?: string[];
  defaultModel?: string;
}

export interface ProvidersListResponse {
  providers: ProviderMetadata[];
  current: string | null;
}

export interface SwitchProviderResponse {
  success: boolean;
  current: string;
  message: string;
}

export interface SettingsSyncRequest {
  sandboxProvider?: string;
  sandboxConfig?: Record<string, unknown>;
  agentProvider?: string;
  agentConfig?: Record<string, unknown>;
}

export interface ProvidersConfig {
  sandbox?: {
    category: string;
    type: string;
    config?: Record<string, unknown>;
  };
  agent?: {
    category: string;
    type: string;
    config?: Record<string, unknown>;
  };
}

const SANDBOX_PROVIDER_DETAILS: Record<
  string,
  Omit<
    SandboxProviderMetadata,
    'type' | 'name' | 'version' | 'configSchema' | 'available' | 'current'
  >
> = {
  codex: {
    description: 'Codex sandbox runtime managed by the desktop app.',
    builtin: true,
    tags: ['desktop', 'sandbox'],
    isolation: 'process',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: false,
  },
  native: {
    description: 'Runs tasks directly on the host machine without isolation.',
    builtin: true,
    tags: ['desktop', 'host'],
    isolation: 'none',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: false,
  },
  docker: {
    description: 'Container-based sandbox provider.',
    builtin: true,
    tags: ['container'],
    isolation: 'container',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: true,
  },
  e2b: {
    description: 'Remote sandbox provider.',
    builtin: true,
    tags: ['remote'],
    isolation: 'vm',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: true,
  },
  claude: {
    description: 'Claude-oriented sandbox configuration.',
    builtin: true,
    tags: ['sandbox'],
    isolation: 'process',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: false,
  },
  custom: {
    description: 'Custom sandbox provider configuration.',
    builtin: false,
    tags: ['custom'],
    isolation: 'process',
    supportedRuntimes: ['node', 'shell'],
    supportsVolumeMounts: true,
    supportsNetworking: true,
    supportsPooling: false,
  },
};

const AGENT_PROVIDER_DETAILS: Record<
  string,
  Omit<
    AgentProviderMetadata,
    'type' | 'name' | 'version' | 'configSchema' | 'available' | 'current'
  >
> = {
  claude: {
    description: 'Claude Code runtime configured in app settings.',
    builtin: true,
    tags: ['agent', 'cli'],
    supportsPlan: true,
    supportsStreaming: true,
    supportsSandbox: true,
  },
  codex: {
    description: 'OpenAI Codex CLI runtime configured in app settings.',
    builtin: true,
    tags: ['agent', 'cli'],
    supportsPlan: true,
    supportsStreaming: true,
    supportsSandbox: true,
  },
  deepagents: {
    description: 'DeepAgents runtime configured in app settings.',
    builtin: true,
    tags: ['agent'],
    supportsPlan: true,
    supportsStreaming: true,
    supportsSandbox: true,
  },
  custom: {
    description: 'Custom agent runtime configured in app settings.',
    builtin: false,
    tags: ['agent', 'custom'],
    supportsPlan: true,
    supportsStreaming: true,
    supportsSandbox: true,
  },
};

const syncSettingsToMain = async (settings: Settings): Promise<void> => {
  if (!window.api?.settings?.update) return;
  await window.api.settings.update(settings as unknown as Record<string, unknown>);
};

const buildSandboxProviderMetadata = (
  provider: SandboxProviderSetting,
  current: string | null
): SandboxProviderMetadata => {
  const details = SANDBOX_PROVIDER_DETAILS[provider.type] ?? SANDBOX_PROVIDER_DETAILS.custom;
  return {
    type: provider.id,
    name: provider.name,
    version: 'local',
    description: details.description,
    configSchema: {},
    builtin: details.builtin,
    tags: details.tags,
    available: provider.enabled,
    current: provider.id === current,
    isolation: details.isolation,
    supportedRuntimes: details.supportedRuntimes,
    supportsVolumeMounts: details.supportsVolumeMounts,
    supportsNetworking: details.supportsNetworking,
    supportsPooling: details.supportsPooling,
  };
};

const buildAgentProviderMetadata = (
  provider: AgentRuntimeSetting,
  current: string | null
): AgentProviderMetadata => {
  const details = AGENT_PROVIDER_DETAILS[provider.type] ?? AGENT_PROVIDER_DETAILS.custom;
  return {
    type: provider.id,
    name: provider.name,
    version: 'local',
    description: details.description,
    configSchema: {},
    builtin: details.builtin,
    tags: details.tags,
    available: provider.enabled,
    current: provider.id === current,
    supportsPlan: details.supportsPlan,
    supportsStreaming: details.supportsStreaming,
    supportsSandbox: details.supportsSandbox,
    supportedModels: typeof provider.config.model === 'string' ? [provider.config.model] : [],
    defaultModel: typeof provider.config.model === 'string' ? provider.config.model : undefined,
  };
};

const buildProvidersConfig = (settings: Settings): ProvidersConfig => {
  const sandbox = settings.sandboxProviders.find(
    (provider) => provider.id === settings.defaultSandboxProvider
  );
  const agent = settings.agentRuntimes.find(
    (provider) => provider.id === settings.defaultAgentRuntime
  );

  return {
    sandbox: sandbox
      ? {
          category: 'sandbox',
          type: sandbox.id,
          config: sandbox.config,
        }
      : undefined,
    agent: agent
      ? {
          category: 'agent',
          type: agent.id,
          config: agent.config,
        }
      : undefined,
  };
};

const updateSandboxSettings = (
  settings: Settings,
  type: string,
  config?: Record<string, unknown>
): Settings => ({
  ...settings,
  defaultSandboxProvider: type,
  sandboxProviders: settings.sandboxProviders.map((provider) =>
    provider.id === type
      ? {
          ...provider,
          enabled: true,
          config: config ?? provider.config,
        }
      : provider
  ),
});

const updateAgentSettings = (
  settings: Settings,
  type: string,
  config?: Record<string, unknown>
): Settings => ({
  ...settings,
  defaultAgentRuntime: type,
  agentRuntimes: settings.agentRuntimes.map((provider) =>
    provider.id === type
      ? {
          ...provider,
          enabled: true,
          config: config ? { ...provider.config, ...config } : provider.config,
        }
      : provider
  ),
});

// ============================================================================
// Provider Functions
// ============================================================================

export async function getSandboxProviders(): Promise<ProvidersListResponse> {
  const settings = getSettings();
  return {
    providers: settings.sandboxProviders.map((provider) =>
      buildSandboxProviderMetadata(provider, settings.defaultSandboxProvider || null)
    ),
    current: settings.defaultSandboxProvider || null,
  };
}

export async function getAvailableSandboxProviders(): Promise<string[]> {
  const settings = getSettings();
  return settings.sandboxProviders.filter((provider) => provider.enabled).map((provider) => provider.id);
}

export async function getSandboxProvider(
  type: string
): Promise<SandboxProviderMetadata> {
  const settings = getSettings();
  const provider = settings.sandboxProviders.find((item) => item.id === type);
  if (!provider) {
    throw new Error(`Sandbox provider "${type}" not found`);
  }
  return buildSandboxProviderMetadata(provider, settings.defaultSandboxProvider || null);
}

export async function switchSandboxProvider(
  type: string,
  config?: Record<string, unknown>
): Promise<SwitchProviderResponse> {
  const settings = getSettings();
  if (!settings.sandboxProviders.some((provider) => provider.id === type)) {
    throw new Error(`Sandbox provider "${type}" not found`);
  }

  const nextSettings = updateSandboxSettings(settings, type, config);
  saveSettings(nextSettings);
  await syncSettingsToMain(nextSettings);

  return {
    success: true,
    current: type,
    message: `Switched sandbox provider to ${type}`,
  };
}

export async function getAgentProviders(): Promise<ProvidersListResponse> {
  const settings = getSettings();
  return {
    providers: settings.agentRuntimes.map((provider) =>
      buildAgentProviderMetadata(provider, settings.defaultAgentRuntime || null)
    ),
    current: settings.defaultAgentRuntime || null,
  };
}

export async function getAvailableAgentProviders(): Promise<string[]> {
  const settings = getSettings();
  return settings.agentRuntimes.filter((provider) => provider.enabled).map((provider) => provider.id);
}

export async function getAgentProvider(
  type: string
): Promise<AgentProviderMetadata> {
  const settings = getSettings();
  const provider = settings.agentRuntimes.find((item) => item.id === type);
  if (!provider) {
    throw new Error(`Agent provider "${type}" not found`);
  }
  return buildAgentProviderMetadata(provider, settings.defaultAgentRuntime || null);
}

export async function switchAgentProvider(
  type: string,
  config?: Record<string, unknown>
): Promise<SwitchProviderResponse> {
  const settings = getSettings();
  if (!settings.agentRuntimes.some((provider) => provider.id === type)) {
    throw new Error(`Agent provider "${type}" not found`);
  }

  const nextSettings = updateAgentSettings(settings, type, config);
  saveSettings(nextSettings);
  await syncSettingsToMain(nextSettings);

  return {
    success: true,
    current: type,
    message: `Switched agent provider to ${type}`,
  };
}

export async function syncSettings(
  settings: SettingsSyncRequest
): Promise<ProvidersConfig> {
  let nextSettings = getSettings();

  if (settings.sandboxProvider) {
    nextSettings = updateSandboxSettings(
      nextSettings,
      settings.sandboxProvider,
      settings.sandboxConfig
    );
  }

  if (settings.agentProvider) {
    nextSettings = updateAgentSettings(nextSettings, settings.agentProvider, settings.agentConfig);
  }

  saveSettings(nextSettings);
  await syncSettingsToMain(nextSettings);

  return buildProvidersConfig(nextSettings);
}

export async function getProvidersConfig(): Promise<ProvidersConfig> {
  return buildProvidersConfig(getSettings());
}
