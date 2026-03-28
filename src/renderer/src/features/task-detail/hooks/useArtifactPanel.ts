import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Artifact } from '@features/artifacts'
import type { Task } from '@/data'
import type { AgentMessage } from '@features/cli-session'

import { extractArtifactsFromMessages, shouldRefreshWorkspaceForMessages } from '../model/artifacts'
import type { RightPanelTab } from '../model/right-panel'
import type { ExecutionStatus } from '../types'

interface UseArtifactPanelInput {
  taskId?: string
  task: Task | null
  messages: AgentMessage[]
  sessionFolder: string | null
  isRunning: boolean
  cliStatus: ExecutionStatus
}

export function useArtifactPanel({
  taskId,
  task,
  messages,
  sessionFolder,
  isRunning,
  cliStatus
}: UseArtifactPanelInput) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [activePreviewTab, setActivePreviewTab] = useState<RightPanelTab>('files')
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0)

  const lastWorkspaceRefreshMessageIndexRef = useRef(0)
  const prevRunStateRef = useRef<{ isRunning: boolean; cliStatus: ExecutionStatus }>({
    isRunning: false,
    cliStatus: 'idle'
  })

  useEffect(() => {
    setIsPreviewVisible(false)
    setActivePreviewTab('files')
    setSelectedArtifact(null)
    setArtifacts([])
    lastWorkspaceRefreshMessageIndexRef.current = 0
    setWorkspaceRefreshToken(0)
  }, [taskId])

  const handleOpenPreviewTab = useCallback((tab: RightPanelTab) => {
    setActivePreviewTab(tab)
    setIsPreviewVisible(true)
  }, [])

  const handleTogglePreviewTab = useCallback(
    (tab: RightPanelTab) => {
      if (isPreviewVisible && activePreviewTab === tab) {
        setIsPreviewVisible(false)
        return
      }

      setActivePreviewTab(tab)
      setIsPreviewVisible(true)
    },
    [activePreviewTab, isPreviewVisible]
  )

  const handleClosePreviewPanel = useCallback(() => {
    setIsPreviewVisible(false)
  }, [])

  const handleSelectArtifact = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact)
    if (artifact) {
      setActivePreviewTab('files')
      setIsPreviewVisible(true)
    }
  }, [])

  const handleClosePreview = useCallback(() => {
    setSelectedArtifact(null)
  }, [])

  useEffect(() => {
    setArtifacts(extractArtifactsFromMessages(messages))
  }, [messages, taskId])

  useEffect(() => {
    if (messages.length < lastWorkspaceRefreshMessageIndexRef.current) {
      lastWorkspaceRefreshMessageIndexRef.current = 0
    }

    if (messages.length === 0) {
      return
    }

    const startIndex = lastWorkspaceRefreshMessageIndexRef.current
    if (startIndex >= messages.length) {
      return
    }

    const newMessages = messages.slice(startIndex)
    lastWorkspaceRefreshMessageIndexRef.current = messages.length

    if (shouldRefreshWorkspaceForMessages(newMessages)) {
      setWorkspaceRefreshToken((previous) => previous + 1)
    }
  }, [messages])

  useEffect(() => {
    const previous = prevRunStateRef.current
    const wasRunning = previous.isRunning || previous.cliStatus === 'running'
    const isNowRunning = isRunning || cliStatus === 'running'

    if (wasRunning && !isNowRunning) {
      setWorkspaceRefreshToken((previousToken) => previousToken + 1)
    }

    prevRunStateRef.current = { isRunning, cliStatus }
  }, [cliStatus, isRunning])

  const workingDir = useMemo(() => {
    if (task?.workspace_path) {
      return task.workspace_path
    }

    if (task?.worktree_path) {
      return task.worktree_path
    }

    if (sessionFolder) {
      return sessionFolder
    }

    for (const artifact of artifacts) {
      if (artifact.path?.includes('/sessions/')) {
        const match = artifact.path.match(/^(.+\/sessions\/[^/]+)/)
        if (match) {
          return match[1]
        }
      }
    }

    return ''
  }, [artifacts, sessionFolder, task?.workspace_path, task?.worktree_path])

  return {
    artifacts,
    selectedArtifact,
    activePreviewTab,
    isPreviewVisible,
    workspaceRefreshToken,
    workingDir,
    handleOpenPreviewTab,
    handleTogglePreviewTab,
    handleClosePreviewPanel,
    handleSelectArtifact,
    handleClosePreview,
    setIsPreviewVisible
  }
}
