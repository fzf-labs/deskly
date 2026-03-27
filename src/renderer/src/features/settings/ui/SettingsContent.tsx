import { useEffect, useState } from 'react'

import {
  getSettings,
  saveSettings,
  syncSettingsWithBackend,
  type Settings as SettingsType
} from '@/data/settings'
import { cn } from '@/lib/utils'
import { AboutSettings } from '@/components/settings/tabs/AboutSettings'
import { AccountSettings } from '@/components/settings/tabs/AccountSettings'
import { AgentCLISettings } from '@/components/settings/tabs/AgentCLISettings'
import { CLIToolsSettings } from '@/components/settings/tabs/CLIToolsSettings'
import { DataSettings } from '@/components/settings/tabs/DataSettings'
import { EditorSettings } from '@/components/settings/tabs/EditorSettings'
import { GeneralSettings } from '@/components/settings/tabs/GeneralSettings'
import { GitSettings } from '@/components/settings/tabs/GitSettings'
import { MCPSettings } from '@/components/settings/tabs/MCPSettings'
import { NotificationSettings } from '@/components/settings/tabs/NotificationSettings'
import { ProjectsSettings } from '@/components/settings/tabs/ProjectsSettings'
import { SkillsSettings } from '@/components/settings/tabs/SkillsSettings'
import { SoundSettings } from '@/components/settings/tabs/SoundSettings'
import { WorkflowTemplatesSettings } from '@/components/settings/tabs/WorkflowTemplatesSettings'

import type { SettingsCategory } from '../types'

interface SettingsContentProps {
  activeCategory: SettingsCategory
  className?: string
}

export function SettingsContent({
  activeCategory,
  className
}: SettingsContentProps) {
  const [settings, setSettings] = useState<SettingsType>(getSettings)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  const handleSettingsChange = (newSettings: SettingsType) => {
    setSettings(newSettings)
    saveSettings(newSettings)
    syncSettingsWithBackend().catch((error) => {
      console.error('[Settings] Failed to sync with backend:', error)
    })
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {activeCategory === 'account' && (
          <AccountSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'general' && (
          <GeneralSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'projects' && <ProjectsSettings />}

        {activeCategory === 'sound' && (
          <SoundSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'notification' && (
          <NotificationSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'editor' && (
          <EditorSettings settings={settings} onSettingsChange={handleSettingsChange} />
        )}

        {activeCategory === 'cliTools' && <CLIToolsSettings />}

        {activeCategory === 'cli' && (
          <AgentCLISettings settings={settings} onSettingsChange={handleSettingsChange} />
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
  )
}
