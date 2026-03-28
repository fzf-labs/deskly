import { ArtifactPreview, type Artifact } from '@features/artifacts'

import type { RightPanelTab } from '../model/right-panel'
import { RightPanel } from './RightPanel'

interface RightPanelSectionProps {
  isVisible: boolean
  taskId: string | null
  workingDir: string | null
  branchName: string | null
  baseBranch: string | null
  activeTab: RightPanelTab
  selectedArtifact: Artifact | null
  artifacts: Artifact[]
  onSelectArtifact: (artifact: Artifact | null) => void
  workspaceRefreshToken?: number
  onClosePanel: () => void
  onClosePreview: () => void
}

export function RightPanelSection({
  isVisible,
  taskId,
  workingDir,
  branchName,
  baseBranch,
  activeTab,
  selectedArtifact,
  artifacts,
  onSelectArtifact,
  workspaceRefreshToken,
  onClosePanel,
  onClosePreview
}: RightPanelSectionProps) {
  if (!isVisible) return null

  return (
    <div className="bg-muted/10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <RightPanel
        taskId={taskId}
        workingDir={workingDir}
        branchName={branchName}
        baseBranch={baseBranch}
        activeTab={activeTab}
        selectedArtifact={selectedArtifact}
        onSelectArtifact={onSelectArtifact}
        workspaceRefreshToken={workspaceRefreshToken}
        onClose={onClosePanel}
        renderFilePreview={() => (
          <ArtifactPreview
            artifact={selectedArtifact}
            onClose={onClosePreview}
            allArtifacts={artifacts}
          />
        )}
      />
    </div>
  )
}
