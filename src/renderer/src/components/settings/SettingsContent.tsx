import { useEffect, useState } from 'react';
import {
  getSettings,
  saveSettings,
  syncSettingsWithBackend,
  type Settings as SettingsType,
} from '@/data/settings';
import { cn } from '@/lib/utils';
import { AboutSettings } from './tabs/AboutSettings';
import { AccountSettings } from './tabs/AccountSettings';
import { CLISettings } from './tabs/CLISettings';
import { DataSettings } from './tabs/DataSettings';
import { EditorSettings } from './tabs/EditorSettings';
import { GitSettings } from './tabs/GitSettings';
import { GeneralSettings } from './tabs/GeneralSettings';
import { MCPSettings } from './tabs/MCPSettings';
import { NotificationSettings } from './tabs/NotificationSettings';
import { SkillsSettings } from './tabs/SkillsSettings';
import { SoundSettings } from './tabs/SoundSettings';
import { WorkflowTemplatesSettings } from './tabs/WorkflowTemplatesSettings';
import type { SettingsCategory } from './types';

interface SettingsContentProps {
  activeCategory: SettingsCategory;
  className?: string;
}

export function SettingsContent({
  activeCategory,
  className,
}: SettingsContentProps) {
  const [settings, setSettings] = useState<SettingsType>(getSettings);
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleSettingsChange = (newSettings: SettingsType) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    syncSettingsWithBackend().catch((error) => {
      console.error('[Settings] Failed to sync with backend:', error);
    });
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {activeCategory === 'account' && (
          <AccountSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'general' && (
          <GeneralSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'sound' && (
          <SoundSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'notification' && (
          <NotificationSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'editor' && (
          <EditorSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'cli' && (
          <CLISettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'git' && (
          <GitSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'pipelineTemplates' && <WorkflowTemplatesSettings />}

        {activeCategory === 'mcp' && (
          <MCPSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'skills' && (
          <SkillsSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'data' && <DataSettings />}

        {activeCategory === 'about' && <AboutSettings />}
      </div>
    </div>
  );
}
