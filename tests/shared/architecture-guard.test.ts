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
  'ui/FileTooLarge.tsx',
  'ui/WebSearchPreview.tsx'
]

const requiredSettingsFeatureFiles = [
  'ui/SettingsContent.tsx',
  'ui/SettingsSidebar.tsx',
  'ui/constants.tsx'
]

const featureImportPattern = /from\s+['"](@features\/[^'"]+)['"]/g
const legacyArtifactImportPattern = /from\s+['"](@\/components\/artifacts(?:\/[^'"]+)?)['"]/g
const legacySettingsShellImportPattern =
  /from\s+['"](@\/components\/settings\/(?:SettingsContent|SettingsSidebar|constants))['"]/g

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
      if (
        relativePath.startsWith('src/renderer/src/components/artifacts/') ||
        relativePath === 'src/renderer/src/features/artifacts/index.ts' ||
        relativePath === 'src/renderer/src/features/artifacts/ui/ArtifactPreview.tsx'
      ) {
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
})
