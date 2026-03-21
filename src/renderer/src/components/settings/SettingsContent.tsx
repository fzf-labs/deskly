import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  getSettings,
  saveSettings,
  syncSettingsWithBackend,
  type Settings as SettingsType,
} from '@/data/settings';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';

import { categoryIcons } from './constants';
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
  initialCategory?: SettingsCategory;
  className?: string;
  onBack?: () => void;
}

const categories: SettingsCategory[] = [
  'account',
  'general',
  'sound',
  'notification',
  'editor',
  'cli',
  'git',
  'pipelineTemplates',
  'mcp',
  'skills',
  'data',
  'about',
];

export function SettingsContent({
  initialCategory = 'account',
  className,
  onBack,
}: SettingsContentProps) {
  const [settings, setSettings] = useState<SettingsType>(getSettings);
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>(initialCategory);
  const { t } = useLanguage();

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const getCategoryLabel = (id: SettingsCategory): string => {
    return t.settings[id];
  };

  const handleSettingsChange = (newSettings: SettingsType) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    syncSettingsWithBackend().catch((error) => {
      console.error('[Settings] Failed to sync with backend:', error);
    });
  };

  return (
    <div className={cn('flex h-full min-h-0', className)}>
      <div className="border-border bg-muted/30 flex w-56 flex-col border-r">
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {categories.map((id) => {
            const Icon = categoryIcons[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveCategory(id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus:outline-none focus-visible:outline-none',
                  activeCategory === id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-foreground/70 hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{getCategoryLabel(id)}</span>
              </button>
            );
          })}
        </nav>

        {onBack ? (
          <div className="border-border border-t p-2">
            <button
              type="button"
              onClick={onBack}
              className="text-foreground/70 hover:bg-accent/50 hover:text-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus:outline-none focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" />
              <span className="flex-1 text-left">{t.settings.back}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeCategory === 'account' && (
            <AccountSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'general' && (
            <GeneralSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'sound' && (
            <SoundSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'notification' && (
            <NotificationSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'editor' && (
            <EditorSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'cli' && (
            <CLISettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'git' && (
            <GitSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'pipelineTemplates' && (
            <WorkflowTemplatesSettings />
          )}

          {activeCategory === 'mcp' && (
            <MCPSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'skills' && (
            <SkillsSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}

          {activeCategory === 'data' && <DataSettings />}

          {activeCategory === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}
