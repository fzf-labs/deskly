import {
  filterEnabledCliTools as filterEnabledCliToolsShared,
  getEnabledCliToolIds as getEnabledCliToolIdsShared,
  isCliToolEnabled as isCliToolEnabledShared
} from '../../../../../shared/agent-cli-tool-enablement'
import { getSettings, type Settings } from '@/data/settings'

export const isCliToolEnabled = (
  toolId: string | null | undefined,
  settings: Pick<Settings, 'enabledCliTools'> = getSettings()
): boolean => isCliToolEnabledShared(toolId, settings.enabledCliTools)

export const getEnabledCliToolIds = (
  settings: Pick<Settings, 'enabledCliTools'> = getSettings()
): string[] => getEnabledCliToolIdsShared(settings.enabledCliTools)

export const filterEnabledCliTools = <T extends { id: string }>(
  tools: T[],
  settings: Pick<Settings, 'enabledCliTools'> = getSettings()
): T[] => filterEnabledCliToolsShared(tools, settings.enabledCliTools)
