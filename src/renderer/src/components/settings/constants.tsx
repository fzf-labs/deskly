import type { ComponentType } from 'react';
import {
  Bell,
  Code,
  Database,
  FolderKanban,
  GitBranch,
  Info,
  ListChecks,
  Plug,
  Server,
  Settings,
  Sparkles,
  Terminal,
  User,
  Volume2,
  Wrench,
} from 'lucide-react';

import { SETTINGS_CATEGORIES, type SettingsCategory } from './types';

export const settingsCategories = SETTINGS_CATEGORIES;

// Category icons mapping
export const categoryIcons: Record<
  SettingsCategory,
  ComponentType<{ className?: string }>
> = {
  account: User,
  general: Settings,
  projects: FolderKanban,
  sound: Volume2,
  notification: Bell,
  editor: Code,
  cliTools: Wrench,
  cli: Terminal,
  git: GitBranch,
  pipelineTemplates: ListChecks,
  mcp: Server,
  skills: Sparkles,
  connector: Plug,
  data: Database,
  about: Info,
};

// Re-export API config
export { API_PORT, API_BASE_URL } from '@/config';
