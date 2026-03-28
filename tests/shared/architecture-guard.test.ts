import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const featuresRoot = join(repoRoot, 'src/renderer/src/features')
const rendererRoot = join(repoRoot, 'src/renderer/src')
const sharedContractsRoot = join(repoRoot, 'src/shared/contracts')

const requiredFrontendSpecFiles = [
  'index.md',
  'directory-structure.md',
  'component-guidelines.md',
  'hook-guidelines.md',
  'state-management.md',
  'quality-guidelines.md',
  'type-safety.md'
]

const requiredBackendSpecFiles = [
  'index.md',
  'service-guidelines.md',
  'repository-guidelines.md',
  'ipc-guidelines.md'
]

const requiredSharedContractFiles = [
  'task.ts',
  'workflow.ts',
  'automation.ts',
  'cli-session.ts',
  'project.ts',
  'notification.ts'
]

const requiredArtifactFeatureFiles = [
  'model/types.ts',
  'model/utils.ts',
  'model/file-types.ts',
  'model/web-search.ts',
  'ui/ArtifactPreview.tsx',
  'ui/AudioPreview.tsx',
  'ui/CodePreview.tsx',
  'ui/DocxPreview.tsx',
  'ui/ExcelPreview.tsx',
  'ui/FileTooLarge.tsx',
  'ui/FontPreview.tsx',
  'ui/ImagePreview.tsx',
  'ui/PdfPreview.tsx',
  'ui/PptxPreview.tsx',
  'ui/VideoPreview.tsx',
  'ui/WebSearchPreview.tsx'
]

const requiredSettingsFeatureFiles = [
  'components/Switch.tsx',
  'tabs/AboutSettings.tsx',
  'tabs/AccountSettings.tsx',
  'tabs/AgentCLISettings.tsx',
  'tabs/CLIToolsSettings.tsx',
  'tabs/DataSettings.tsx',
  'tabs/EditorSettings.tsx',
  'tabs/GeneralSettings.tsx',
  'tabs/GitSettings.tsx',
  'tabs/MCPSettings.tsx',
  'tabs/NotificationSettings.tsx',
  'tabs/ProjectsSettings.tsx',
  'tabs/SkillsSettings.tsx',
  'tabs/SoundSettings.tsx',
  'tabs/SystemCliToolDetailDialog.tsx',
  'tabs/WorkflowTemplatesSettings.tsx',
  'ui/SettingsContent.tsx',
  'ui/SettingsSidebar.tsx',
  'ui/constants.tsx'
]

const requiredAutomationFeatureFiles = ['AutomationsPage.tsx', 'ui/TriggerBadge.tsx']

const requiredGitFeatureFiles = [
  'ui/DiffViewer.tsx',
  'ui/GitDiffView.tsx',
  'ui/ChangedFilesList.tsx',
  'ui/CommitHistory.tsx',
  'ui/BranchSelector.tsx'
]

const requiredTerminalFeatureFiles = [
  'ui/TerminalPanel.tsx',
  'ui/TerminalView.tsx',
  'model/helpers.ts'
]

const requiredHomeFeatureFiles = [
  'hooks/useDashboardData.ts',
  'ui/AgentMessages.tsx',
  'ui/TaskInput.tsx'
]

const requiredProjectsFeatureFiles = [
  'ProjectsPage.tsx',
  'hooks/useProjects.ts',
  'ui/ProjectDialogs.tsx'
]

const requiredTaskDetailFeatureFiles = [
  'model/tool-selection-context.ts',
  'model/right-panel.ts',
  'components/ErrorMessage.tsx',
  'components/FileListPanel.tsx',
  'components/MessageItem.tsx',
  'components/MessageList.tsx',
  'components/PlanApproval.tsx',
  'components/RightPanel.tsx',
  'components/RunningIndicator.tsx',
  'components/UserMessage.tsx'
]

const requiredTasksFeatureFiles = [
  'hooks/useTaskComposer.ts',
  'ui/CreateTaskDialog.tsx',
  'ui/TaskComposer.tsx',
  'ui/TaskCreateMenu.tsx'
]

const featureImportPattern = /from\s+['"](@features\/[^'"]+)['"]/g
const legacyArtifactImportPattern = /from\s+['"](@\/components\/artifacts(?:\/[^'"]+)?)['"]/g
const legacySettingsShellImportPattern =
  /from\s+['"](@\/components\/settings\/(?:SettingsContent|SettingsSidebar|constants))['"]/g
const legacySettingsTabImportPattern =
  /from\s+['"](@\/components\/settings\/tabs\/(?:AboutSettings|AccountSettings|AgentCLISettings|CLIToolsSettings|DataSettings|EditorSettings|GeneralSettings|GitSettings|MCPSettings|NotificationSettings|ProjectsSettings|SkillsSettings|SoundSettings|SystemCliToolDetailDialog|WorkflowTemplatesSettings))['"]/g
const legacySettingsSwitchImportPattern =
  /from\s+['"](@\/components\/settings\/components\/Switch)['"]/g
const legacyRendererHookImportPattern =
  /from\s+['"](@\/hooks\/(?:useAgent|useSessionLogs|useLogStream|useProjects|useDashboardData))['"]/g
const legacyRendererLibImportPattern =
  /from\s+['"](@\/lib\/(?:notifications|providers|session))['"]/g
const legacyTaskImportPattern = /from\s+['"](@\/components\/task(?:\/[^'"]+)?)['"]/g
const legacyAutomationTriggerImportPattern =
  /from\s+['"](@\/components\/automation\/TriggerBadge)['"]/g
const legacyGitImportPattern = /from\s+['"](@\/components\/git(?:\/[^'"]+)?)['"]/g
const legacyTerminalImportPattern = /from\s+['"](@\/components\/terminal(?:\/[^'"]+)?)['"]/g
const legacyHomeImportPattern = /from\s+['"](@\/components\/home(?:\/[^'"]+)?)['"]/g
const legacyProjectDialogsImportPattern =
  /from\s+['"](@\/components\/projects\/ProjectDialogs)['"]/g

const walkFiles = (directoryPath: string): string[] => {
  const entries = readdirSync(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath))
      continue
    }

    files.push(entryPath)
  }

  return files
}

const expectDocumentSet = (directoryPath: string, files: string[]) => {
  for (const fileName of files) {
    const filePath = join(directoryPath, fileName)

    expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    expect(readFileSync(filePath, 'utf-8').trim().length).toBeGreaterThan(0)
  }
}

describe('architecture guards', () => {
  it('keeps required frontend and backend spec documents in place', () => {
    expectDocumentSet(join(repoRoot, '.trellis/spec/frontend'), requiredFrontendSpecFiles)
    expectDocumentSet(join(repoRoot, '.trellis/spec/backend'), requiredBackendSpecFiles)
  })

  it('keeps the required shared contract modules in place', () => {
    for (const fileName of requiredSharedContractFiles) {
      const filePath = join(sharedContractsRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('gives every renderer feature folder a public index barrel', () => {
    const featureDirectories = readdirSync(featuresRoot).filter((entryName) =>
      statSync(join(featuresRoot, entryName)).isDirectory()
    )

    for (const featureName of featureDirectories) {
      const indexPath = join(featuresRoot, featureName, 'index.ts')
      expect(existsSync(indexPath), `${relative(repoRoot, indexPath)} should exist`).toBe(true)
    }
  })

  it('keeps the artifacts feature model files in place', () => {
    const artifactsRoot = join(featuresRoot, 'artifacts')

    for (const fileName of requiredArtifactFeatureFiles) {
      const filePath = join(artifactsRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the settings feature shell files in place', () => {
    const settingsRoot = join(featuresRoot, 'settings')

    for (const fileName of requiredSettingsFeatureFiles) {
      const filePath = join(settingsRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the automation feature files in place', () => {
    const automationRoot = join(featuresRoot, 'automation')

    for (const fileName of requiredAutomationFeatureFiles) {
      const filePath = join(automationRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the git feature ui files in place', () => {
    const gitRoot = join(featuresRoot, 'git')

    for (const fileName of requiredGitFeatureFiles) {
      const filePath = join(gitRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the terminal feature ui files in place', () => {
    const terminalRoot = join(featuresRoot, 'terminal')

    for (const fileName of requiredTerminalFeatureFiles) {
      const filePath = join(terminalRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the home feature files in place', () => {
    const homeRoot = join(featuresRoot, 'home')

    for (const fileName of requiredHomeFeatureFiles) {
      const filePath = join(homeRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the projects feature files in place', () => {
    const projectsRoot = join(featuresRoot, 'projects')

    for (const fileName of requiredProjectsFeatureFiles) {
      const filePath = join(projectsRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the task-detail feature files in place', () => {
    const taskDetailRoot = join(featuresRoot, 'task-detail')

    for (const fileName of requiredTaskDetailFeatureFiles) {
      const filePath = join(taskDetailRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('keeps the tasks feature ui files in place', () => {
    const tasksRoot = join(featuresRoot, 'tasks')

    for (const fileName of requiredTasksFeatureFiles) {
      const filePath = join(tasksRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
    }
  })

  it('only allows cross-feature imports through feature index barrels', () => {
    const sourceFiles = walkFiles(featuresRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const fileContent = readFileSync(filePath, 'utf-8')

      for (const match of fileContent.matchAll(featureImportPattern)) {
        const importPath = match[1]
        const importTarget = importPath.slice('@features/'.length)

        if (importTarget.includes('/')) {
          violations.push(`${relative(repoRoot, filePath)} -> ${importPath}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps legacy artifacts imports contained to the artifacts compatibility layer', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/artifacts/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyArtifactImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyArtifactImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps legacy settings shell imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (
        relativePath === 'src/renderer/src/components/settings/SettingsContent.tsx' ||
        relativePath === 'src/renderer/src/components/settings/SettingsSidebar.tsx' ||
        relativePath === 'src/renderer/src/components/settings/constants.tsx'
      ) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacySettingsShellImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacySettingsShellImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated settings tab imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (
        relativePath === 'src/renderer/src/components/settings/tabs/AboutSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/AccountSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/AgentCLISettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/CLIToolsSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/DataSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/EditorSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/GeneralSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/GitSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/MCPSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/NotificationSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/ProjectsSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/SkillsSettings.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/SoundSettings.tsx' ||
        relativePath ===
          'src/renderer/src/components/settings/tabs/SystemCliToolDetailDialog.tsx' ||
        relativePath === 'src/renderer/src/components/settings/tabs/WorkflowTemplatesSettings.tsx'
      ) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacySettingsTabImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacySettingsTabImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated settings switch imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath === 'src/renderer/src/components/settings/components/Switch.tsx') {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacySettingsSwitchImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacySettingsSwitchImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated renderer business hooks contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (
        relativePath === 'src/renderer/src/hooks/useAgent.ts' ||
        relativePath === 'src/renderer/src/hooks/useSessionLogs.ts' ||
        relativePath === 'src/renderer/src/hooks/useLogStream.ts' ||
        relativePath === 'src/renderer/src/hooks/useProjects.ts' ||
        relativePath === 'src/renderer/src/hooks/useDashboardData.ts'
      ) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyRendererHookImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyRendererHookImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated renderer side-effect libs contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (
        relativePath === 'src/renderer/src/lib/notifications.ts' ||
        relativePath === 'src/renderer/src/lib/providers.ts' ||
        relativePath === 'src/renderer/src/lib/session.ts'
      ) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyRendererLibImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyRendererLibImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated task imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/task/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyTaskImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyTaskImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated automation trigger imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath === 'src/renderer/src/components/automation/TriggerBadge.tsx') {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyAutomationTriggerImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyAutomationTriggerImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated git imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/git/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyGitImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyGitImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated terminal imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/terminal/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyTerminalImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyTerminalImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated home imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/home/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyHomeImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyHomeImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated home imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath.startsWith('src/renderer/src/components/home/')) {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyHomeImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyHomeImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps migrated project dialog imports contained to compatibility wrappers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      if (relativePath === 'src/renderer/src/components/projects/ProjectDialogs.tsx') {
        continue
      }

      const fileContent = readFileSync(filePath, 'utf-8')
      if (legacyProjectDialogsImportPattern.test(fileContent)) {
        violations.push(relativePath)
      }
      legacyProjectDialogsImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })
})
