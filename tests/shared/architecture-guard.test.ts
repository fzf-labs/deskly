import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const featuresRoot = join(repoRoot, 'src/renderer/src/features')
const rendererRoot = join(repoRoot, 'src/renderer/src')
const sharedContractsRoot = join(repoRoot, 'src/shared/contracts')
const componentsRoot = join(rendererRoot, 'components')
const hooksRoot = join(rendererRoot, 'hooks')
const libRoot = join(rendererRoot, 'lib')

const legacyWorkspaceName = String.fromCharCode(116, 114, 101, 108, 108, 105, 115)
const removedLegacyWorkspacePaths = [
  `.${legacyWorkspaceName}`,
  `.${legacyWorkspaceName}/spec`,
  `.${legacyWorkspaceName}/tasks`
]
const removedLegacyWorkspacePattern = new RegExp(`(?:\\.${legacyWorkspaceName}|${legacyWorkspaceName})`, 'i')
const legacyCleanupDocs = [
  'docs/architecture-adjustment-plan.md',
  'docs/golemancy-agent-analysis.md',
  'docs/agent-product-usage-flows.md'
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
  'model/mcp.ts',
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

const requiredAutomationFeatureFiles = [
  'AutomationsPage.tsx',
  'ui/AutomationFormDialog.tsx',
  'ui/AutomationItem.tsx',
  'ui/AutomationList.tsx',
  'ui/AutomationRunList.tsx',
  'ui/TriggerBadge.tsx'
]
const requiredSkillsFeatureFiles = ['SkillsPage.tsx', 'model/skills.ts']
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
  'model/routing.ts',
  'ui/ProjectDialogs.tsx'
]
const requiredTaskDetailFeatureFiles = [
  'hooks/useVitePreview.ts',
  'model/tool-selection-context.ts',
  'model/right-panel.ts',
  'components/ErrorMessage.tsx',
  'components/FileListPanel.tsx',
  'components/MessageItem.tsx',
  'components/MessageList.tsx',
  'components/PlanApproval.tsx',
  'components/QuestionInput.tsx',
  'components/RightPanel.tsx',
  'components/RunningIndicator.tsx',
  'components/TaskGroupComponent.tsx',
  'components/ToolExecutionItem.tsx',
  'components/UserMessage.tsx',
  'components/VirtualComputer.tsx',
  'components/VitePreview.tsx'
]
const requiredTasksFeatureFiles = [
  'hooks/useTaskComposer.ts',
  'model/task-events.ts',
  'model/task-status.ts',
  'ui/CreateTaskDialog.tsx',
  'ui/TaskComposer.tsx',
  'ui/TaskCreateMenu.tsx',
  'ui/TaskList.tsx',
  'ui/TaskMetadataPanel.tsx',
  'ui/WorkflowProgressBar.tsx'
]
const requiredCliToolsFeatureFiles = [
  'model/agent-cli-tool-enablement.ts',
  'model/agent-cli-tools.ts',
  'model/system-cli-tools.ts'
]

const featureImportPattern = /from\s+['"](@features\/[^'"]+)['"]/g
const pageImportPattern = /from\s+['"](@\/pages\/[^'"]+)['"]/g
const legacyComponentImportPattern =
  /from\s+['"](@\/components\/(?:artifacts|automation|cli|git|home|pipeline|projects|settings|task|terminal)(?:\/[^'"]+)?)['"]/g
const legacyHookImportPattern =
  /from\s+['"](@\/hooks\/(?:agent(?:\/[^'"]+)?|useAgent|useDashboardData|useLogStream|useProjects|useProviders|useSessionLogs|useVitePreview))['"]/g
const legacyLibImportPattern =
  /from\s+['"](@\/lib\/(?:agent-cli-tool-enablement|agent-cli-tools|background-tasks|mcp|notifications|project-routing|prompt-optimization|providers|session|session-logs|skills|system-cli-tools|task-events|task-status))['"]/g

const removedComponentDirs = [
  'artifacts',
  'automation',
  'cli',
  'git',
  'home',
  'pipeline',
  'projects',
  'settings',
  'task',
  'terminal'
]

const removedHookEntries = [
  'agent',
  'useAgent.ts',
  'useDashboardData.ts',
  'useLogStream.ts',
  'useProjects.ts',
  'useProviders.ts',
  'useSessionLogs.ts',
  'useVitePreview.ts'
]

const removedLibFiles = [
  'agent-cli-tool-enablement.ts',
  'agent-cli-tools.ts',
  'background-tasks.ts',
  'mcp.ts',
  'notifications.ts',
  'project-routing.ts',
  'prompt-optimization.ts',
  'providers.ts',
  'session-logs.ts',
  'session.ts',
  'skills.ts',
  'system-cli-tools.ts',
  'task-events.ts',
  'task-status.ts'
]
const allowedLibFiles = ['electron-api.ts', 'ids.ts', 'paths.ts', 'utils.ts']
const removedPageCompatibilityFiles = [
  'src/renderer/src/pages/automations/AutomationsPage.tsx',
  'src/renderer/src/pages/generated-workflow-review/GeneratedWorkflowReviewPage.tsx',
  'src/renderer/src/pages/pipeline/PipelineTemplatesPage.tsx',
  'src/renderer/src/pages/pipeline/WorkflowTemplateEditorPage.tsx',
  'src/renderer/src/pages/projects/ProjectsPage.tsx',
  'src/renderer/src/pages/settings/SettingsPage.tsx',
  'src/renderer/src/pages/skills/SkillsPage.tsx',
  'src/renderer/src/pages/task-detail/TaskDetailContainer.tsx',
  'src/renderer/src/pages/task-detail/TaskDetailPage.tsx',
  'src/renderer/src/pages/task-detail/components/ExecutionPanel.tsx',
  'src/renderer/src/pages/task-detail/components/ReplyCard.tsx',
  'src/renderer/src/pages/task-detail/components/RightPanelSection.tsx',
  'src/renderer/src/pages/task-detail/components/TaskDetailHeader.tsx',
  'src/renderer/src/pages/task-detail/components/TaskDialogs.tsx',
  'src/renderer/src/pages/task-detail/components/WorkflowCard.tsx',
  'src/renderer/src/pages/task-detail/constants.ts',
  'src/renderer/src/pages/task-detail/types.ts',
  'src/renderer/src/pages/task-detail/useTaskDetail.tsx',
  'src/renderer/src/pages/task-detail/workflow-graph.ts',
  'src/renderer/src/pages/automations/components/AutomationFormDialog.tsx',
  'src/renderer/src/pages/automations/components/AutomationItem.tsx',
  'src/renderer/src/pages/automations/components/AutomationList.tsx',
  'src/renderer/src/pages/automations/components/AutomationRunList.tsx'
]

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

const expectFeatureFileSet = (featureName: string, files: string[]) => {
  const featureRoot = join(featuresRoot, featureName)

  for (const fileName of files) {
    const filePath = join(featureRoot, fileName)
    expect(existsSync(filePath), `${relative(repoRoot, filePath)} should exist`).toBe(true)
  }
}

describe('architecture guards', () => {
  it('removes the legacy workspace directories and references from maintained docs', () => {
    for (const relativePath of removedLegacyWorkspacePaths) {
      const filePath = join(repoRoot, relativePath)
      expect(existsSync(filePath), `${relativePath} should stay removed`).toBe(false)
    }

    for (const relativePath of legacyCleanupDocs) {
      const filePath = join(repoRoot, relativePath)
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true)
      expect(readFileSync(filePath, 'utf-8')).not.toMatch(removedLegacyWorkspacePattern)
    }
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

  it('keeps the required feature file sets in place', () => {
    expectFeatureFileSet('artifacts', requiredArtifactFeatureFiles)
    expectFeatureFileSet('settings', requiredSettingsFeatureFiles)
    expectFeatureFileSet('automation', requiredAutomationFeatureFiles)
    expectFeatureFileSet('skills', requiredSkillsFeatureFiles)
    expectFeatureFileSet('git', requiredGitFeatureFiles)
    expectFeatureFileSet('terminal', requiredTerminalFeatureFiles)
    expectFeatureFileSet('home', requiredHomeFeatureFiles)
    expectFeatureFileSet('projects', requiredProjectsFeatureFiles)
    expectFeatureFileSet('task-detail', requiredTaskDetailFeatureFiles)
    expectFeatureFileSet('tasks', requiredTasksFeatureFiles)
    expectFeatureFileSet('cli-tools', requiredCliToolsFeatureFiles)
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

  it('does not allow feature modules to depend on page-layer modules', () => {
    const sourceFiles = walkFiles(featuresRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const fileContent = readFileSync(filePath, 'utf-8')

      if (pageImportPattern.test(fileContent)) {
        violations.push(`${relative(repoRoot, filePath)} -> page-layer import`)
      }
      pageImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })

  it('keeps top-level components limited to ui, shared, and layout', () => {
    const componentDirectories = readdirSync(componentsRoot)
      .filter((entryName) => statSync(join(componentsRoot, entryName)).isDirectory())
      .sort()

    expect(componentDirectories).toEqual(['layout', 'shared', 'ui'])

    for (const removedDir of removedComponentDirs) {
      expect(existsSync(join(componentsRoot, removedDir))).toBe(false)
    }
  })

  it('keeps top-level hooks limited to generic utilities', () => {
    const hookEntries = readdirSync(hooksRoot).sort()

    expect(hookEntries).toEqual(['useUnsavedChangesGuard.ts'])

    for (const removedEntry of removedHookEntries) {
      expect(existsSync(join(hooksRoot, removedEntry))).toBe(false)
    }
  })

  it('removes obsolete renderer lib compatibility wrappers', () => {
    for (const fileName of removedLibFiles) {
      const filePath = join(libRoot, fileName)
      expect(existsSync(filePath), `${relative(repoRoot, filePath)} should be removed`).toBe(
        false
      )
    }
  })

  it('keeps top-level lib limited to generic utilities and Electron adapters', () => {
    const libEntries = readdirSync(libRoot).sort()

    expect(libEntries).toEqual(allowedLibFiles)
  })

  it('removes obsolete page compatibility wrappers', () => {
    for (const relativePath of removedPageCompatibilityFiles) {
      const filePath = join(repoRoot, relativePath)
      expect(existsSync(filePath), `${relativePath} should be removed`).toBe(false)
    }
  })

  it('keeps DatabaseService focused on persistence and repository coordination', () => {
    const databaseServiceSource = readFileSync(
      join(repoRoot, 'src/main/services/DatabaseService.ts'),
      'utf-8'
    )
    const createAppContextSource = readFileSync(
      join(repoRoot, 'src/main/app/create-app-context.ts'),
      'utf-8'
    )

    expect(databaseServiceSource).not.toMatch(/AgentToolProfileService/)
    expect(databaseServiceSource).not.toMatch(/WorkflowDefinitionGenerationService/)
    expect(databaseServiceSource).not.toMatch(/PromptOptimizationService/)
    expect(databaseServiceSource).not.toMatch(/AiAuthoringService/)
    expect(databaseServiceSource).not.toMatch(/TaskNodeRuntimeService/)
    expect(databaseServiceSource).not.toMatch(/WorkflowRunLifecycleService/)
    expect(createAppContextSource).toMatch(/new AgentToolProfileService/)
    expect(createAppContextSource).toMatch(/new AiAuthoringService/)
    expect(createAppContextSource).toMatch(/new TaskNodeRuntimeService/)
    expect(createAppContextSource).toMatch(/new WorkflowRunLifecycleService/)
  })

  it('does not allow imports from removed component, hook, or lib compatibility layers', () => {
    const sourceFiles = walkFiles(rendererRoot).filter(
      (filePath) =>
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')
    )
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const relativePath = relative(repoRoot, filePath)
      const fileContent = readFileSync(filePath, 'utf-8')

      if (legacyComponentImportPattern.test(fileContent)) {
        violations.push(`${relativePath} -> removed components compatibility layer`)
      }
      legacyComponentImportPattern.lastIndex = 0

      if (legacyHookImportPattern.test(fileContent)) {
        violations.push(`${relativePath} -> removed hooks compatibility layer`)
      }
      legacyHookImportPattern.lastIndex = 0

      if (legacyLibImportPattern.test(fileContent)) {
        violations.push(`${relativePath} -> removed lib compatibility layer`)
      }
      legacyLibImportPattern.lastIndex = 0
    }

    expect(violations).toEqual([])
  })
})
