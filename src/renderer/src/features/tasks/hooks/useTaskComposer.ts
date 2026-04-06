import { useCallback, useEffect, useMemo, useState } from 'react'

import { db, type AgentToolConfig } from '@/data'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'
import type { MessageAttachment } from '@features/cli-session'
import { filterEnabledCliTools, normalizeCliTools, type CLIToolInfo } from '@features/cli-tools'
import { useLanguage } from '@/providers/language-provider'
import { createTaskWithSideEffects } from '../usecases/task-mutations'

import {
  buildTaskCreatePayload,
  deriveTaskTitle,
  type GeneratedWorkflowReviewRequest,
  isProjectWorkflowTaskCreateMode,
  type TaskCreateMode
} from '../model/task-create'
import {
  compileTaskPrompt,
  getTaskPromptVisibleText,
  normalizeTaskPromptNodes,
  replaceTaskPromptWithText,
  type TaskPromptNode,
  type TaskPromptSlashItem
} from '../model/task-prompt'
import { loadTaskPromptSlashItems } from '../model/task-prompt-slash'

interface UseTaskComposerOptions {
  active?: boolean
  resetOnActivate?: boolean
  projectId?: string
  projectName?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  titleRequired?: boolean
}

interface CreatedTaskContext {
  prompt: string
  attachments?: MessageAttachment[]
  navigateToTaskDetail?: boolean
  startError?: string
}

interface TaskComposerSubmitResult {
  task?: unknown
  context?: CreatedTaskContext
  reviewRequest?: GeneratedWorkflowReviewRequest
}

export function useTaskComposer({
  active = true,
  resetOnActivate = false,
  projectId,
  projectName,
  projectPath,
  projectType = 'normal',
  titleRequired = false
}: UseTaskComposerOptions) {
  const { t } = useLanguage()

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [promptNodes, setPromptNodesState] = useState<TaskPromptNode[]>([])
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])
  const [selectedCliToolId, setSelectedCliToolId] = useState('')
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([])
  const [selectedCliConfigId, setSelectedCliConfigId] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBaseBranch, setSelectedBaseBranch] = useState('')
  const [workflowDefinitions, setWorkflowDefinitions] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [createMode, setCreateMode] = useState<TaskCreateMode>('conversation')
  const [slashItems, setSlashItems] = useState<TaskPromptSlashItem[]>([])
  const [slashLoading, setSlashLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGitProject = projectType === 'git'

  useEffect(() => {
    if (!active || !resetOnActivate) return

    setError(null)
    setTitle('')
    setPrompt('')
    setPromptNodesState([])
    setCreateMode('conversation')
    setSelectedCliToolId('')
    setSelectedCliConfigId('')
    setSelectedTemplateId('')
    setBranches([])
    setSelectedBaseBranch('')
  }, [active, resetOnActivate])

  useEffect(() => {
    if (!active) return

    let mounted = true

    const loadTools = async () => {
      try {
        const snapshot = await window.api?.cliTools?.getSnapshot?.()
        const settings = getSettings()
        const tools = filterEnabledCliTools(normalizeCliTools(snapshot), settings)
        if (!mounted) return

        setCliTools(tools)

        if (!selectedCliToolId) {
          const defaultCliToolId = getEnabledDefaultCliToolId(settings)
          if (defaultCliToolId && tools.some((tool) => tool.id === defaultCliToolId)) {
            setSelectedCliToolId(defaultCliToolId)
          }
        }

        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch (loadError) {
        if (!mounted) return
        console.error('[useTaskComposer] Failed to detect CLI tools:', loadError)
        setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!mounted) return
      setCliTools(filterEnabledCliTools(normalizeCliTools(tools), getSettings()))
    })

    void loadTools()

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [active, selectedCliToolId])

  useEffect(() => {
    if (!active || !selectedCliToolId) return
    if (cliTools.some((tool) => tool.id === selectedCliToolId)) return
    setSelectedCliToolId('')
    setSelectedCliConfigId('')
  }, [active, cliTools, selectedCliToolId])

  useEffect(() => {
    if (!active) return
    if (!selectedCliToolId) {
      setCliConfigs([])
      setSelectedCliConfigId('')
      return
    }

    let mounted = true
    const loadConfigs = async () => {
      try {
        const result = await db.listAgentToolConfigs(selectedCliToolId)
        const list = Array.isArray(result) ? (result as AgentToolConfig[]) : []
        if (!mounted) return

        setCliConfigs(list)
        const hasSelectedConfig =
          selectedCliConfigId && list.some((cfg) => cfg.id === selectedCliConfigId)
        if (!hasSelectedConfig) {
          const defaultConfig = list.find((cfg) => cfg.is_default)
          setSelectedCliConfigId(defaultConfig?.id || '')
        }
      } catch (loadError) {
        if (!mounted) return
        console.error('[useTaskComposer] Failed to load CLI configs:', loadError)
        setCliConfigs([])
        setSelectedCliConfigId('')
      }
    }

    void loadConfigs()
    return () => {
      mounted = false
    }
  }, [active, selectedCliConfigId, selectedCliToolId])

  useEffect(() => {
    if (!active) return
    if (!projectId) {
      setWorkflowDefinitions([])
      setSelectedTemplateId('')
      return
    }

    let mounted = true
    const loadDefinitions = async () => {
      try {
        const [projectDefinitions, globalDefinitions] = await Promise.all([
          db.listWorkflowDefinitions({ scope: 'project', projectId }),
          db.listWorkflowDefinitions({ scope: 'global' })
        ])

        const nextDefinitions = [
          ...(Array.isArray(projectDefinitions)
            ? (projectDefinitions as Array<{ id: string; name: string }>)
            : []),
          ...(Array.isArray(globalDefinitions)
            ? (globalDefinitions as Array<{ id: string; name: string }>)
            : []
          ).map((definition) => ({
            id: definition.id,
            name: `${definition.name}（全局）`
          }))
        ]

        if (!mounted) return
        setWorkflowDefinitions(nextDefinitions)
        if (selectedTemplateId && !nextDefinitions.some((tpl) => tpl.id === selectedTemplateId)) {
          setSelectedTemplateId('')
        }
      } catch (loadError) {
        if (!mounted) return
        console.error('[useTaskComposer] Failed to load workflow definitions:', loadError)
        setWorkflowDefinitions([])
      }
    }

    void loadDefinitions()
    return () => {
      mounted = false
    }
  }, [active, projectId, selectedTemplateId])

  useEffect(() => {
    if (createMode !== 'workflow') return
    if (workflowDefinitions.length === 0) {
      if (selectedTemplateId) setSelectedTemplateId('')
      return
    }
    const exists = workflowDefinitions.some((template) => template.id === selectedTemplateId)
    if (!exists) {
      setSelectedTemplateId(workflowDefinitions[0]!.id)
    }
  }, [createMode, selectedTemplateId, workflowDefinitions])

  useEffect(() => {
    if (!projectId && isProjectWorkflowTaskCreateMode(createMode)) {
      setCreateMode('conversation')
    }
  }, [createMode, projectId])

  useEffect(() => {
    if (!active || !isGitProject || !projectPath) {
      setBranches([])
      setSelectedBaseBranch('')
      return
    }

    let mounted = true
    const loadBranches = async () => {
      try {
        const [branchesResult, currentResult] = await Promise.all([
          window.api?.git?.getBranches?.(projectPath),
          window.api?.git?.getCurrentBranch?.(projectPath)
        ])

        const branchList = Array.isArray(branchesResult)
          ? (branchesResult as string[])
          : Array.isArray((branchesResult as { data?: unknown[] })?.data)
            ? ((branchesResult as { data: string[] }).data as string[])
            : []
        const currentBranch =
          typeof currentResult === 'string'
            ? currentResult
            : ((currentResult as { data?: string })?.data as string | undefined)

        if (!mounted) return

        setBranches(branchList)
        if (currentBranch && branchList.includes(currentBranch)) {
          setSelectedBaseBranch(currentBranch)
        } else if (branchList.length > 0) {
          setSelectedBaseBranch(branchList[0]!)
        } else {
          setSelectedBaseBranch('')
        }
      } catch (loadError) {
        if (!mounted) return
        console.error('[useTaskComposer] Failed to load branches:', loadError)
        setBranches([])
        setSelectedBaseBranch('')
      }
    }

    void loadBranches()
    return () => {
      mounted = false
    }
  }, [active, isGitProject, projectPath])

  const resolvedTaskCliToolId = useMemo(() => {
    const settings = getSettings()
    return selectedCliToolId || getEnabledDefaultCliToolId(settings) || ''
  }, [selectedCliToolId])

  const resolvedTaskCliConfigId = useMemo(
    () => selectedCliConfigId || cliConfigs.find((config) => config.is_default)?.id || '',
    [cliConfigs, selectedCliConfigId]
  )

  const normalizedPromptNodes = useMemo(() => normalizeTaskPromptNodes(promptNodes), [promptNodes])

  const compiledConversationPrompt = useMemo(
    () => compileTaskPrompt(normalizedPromptNodes),
    [normalizedPromptNodes]
  )

  const setPromptValue = useCallback((nextPrompt: string) => {
    setPrompt(nextPrompt)
    setPromptNodesState(replaceTaskPromptWithText(nextPrompt))
  }, [])

  const setPromptNodes = useCallback((nodes: TaskPromptNode[]) => {
    const normalizedNodes = normalizeTaskPromptNodes(nodes)
    setPromptNodesState(normalizedNodes)
    setPrompt(getTaskPromptVisibleText(normalizedNodes))
  }, [])

  useEffect(() => {
    if (createMode !== 'conversation') {
      setSlashItems([])
      setSlashLoading(false)
      return
    }

    if (normalizedPromptNodes.length === 0 && prompt.trim()) {
      setPromptNodesState(replaceTaskPromptWithText(prompt))
    }
  }, [createMode, normalizedPromptNodes.length, prompt])

  useEffect(() => {
    if (!active || createMode !== 'conversation' || !resolvedTaskCliToolId) {
      setSlashItems([])
      setSlashLoading(false)
      return
    }

    let cancelled = false
    const loadItems = async () => {
      try {
        setSlashLoading(true)
        const items = await loadTaskPromptSlashItems({
          toolId: resolvedTaskCliToolId,
          projectPath
        })

        if (!cancelled) {
          setSlashItems(items)
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error('[useTaskComposer] Failed to load slash items:', loadError)
          setSlashItems([])
        }
      } finally {
        if (!cancelled) {
          setSlashLoading(false)
        }
      }
    }

    void loadItems()
    return () => {
      cancelled = true
    }
  }, [active, createMode, projectPath, resolvedTaskCliToolId])

  const createTask = useCallback(
    async (
      text: string,
      attachments?: MessageAttachment[],
      promptNodesOverride?: TaskPromptNode[]
    ): Promise<TaskComposerSubmitResult | null> => {
      const conversationNodes =
        createMode === 'conversation'
          ? normalizeTaskPromptNodes(promptNodesOverride ?? normalizedPromptNodes)
          : []
      const compiledPrompt =
        createMode === 'conversation' ? compileTaskPrompt(conversationNodes).trim() : text.trim()
      const visiblePrompt =
        createMode === 'conversation'
          ? getTaskPromptVisibleText(conversationNodes).trim()
          : text.trim()
      const trimmedTitle = title.trim()

      if (!compiledPrompt && (!attachments || attachments.length === 0)) {
        setError(t.task.createPromptRequired)
        return null
      }

      if (titleRequired && !trimmedTitle) {
        setError(t.task.createTitleRequired)
        return null
      }

      if (createMode === 'conversation' || createMode === 'generated-workflow') {
        if (!resolvedTaskCliToolId) {
          setError(t.task.createCliRequired)
          return null
        }
        if (!resolvedTaskCliConfigId) {
          setError(t.task.createCliConfigRequired)
          return null
        }
      }

      if (isProjectWorkflowTaskCreateMode(createMode) && !projectId) {
        setError(t.task.createPipelineProjectRequired)
        return null
      }

      if (createMode === 'workflow' && !selectedTemplateId) {
        setError(t.task.createWorkflowRequired)
        return null
      }

      if (isGitProject && !selectedBaseBranch) {
        setError(t.task.createBaseBranchRequired)
        return null
      }

      const resolvedTitle = titleRequired ? trimmedTitle : deriveTaskTitle(visiblePrompt)
      const resolvedProjectId = projectId ?? ''

      if (createMode === 'generated-workflow') {
        setError(null)
        return {
          reviewRequest: {
            title: resolvedTitle,
            prompt: compiledPrompt,
            attachments,
            projectId: resolvedProjectId,
            projectName,
            projectPath,
            projectType,
            baseBranch: isGitProject ? selectedBaseBranch || undefined : undefined,
            cliToolId: resolvedTaskCliToolId,
            agentToolConfigId: resolvedTaskCliConfigId
          }
        }
      }

      setLoading(true)
      setError(null)

      try {
        const settings = getSettings()
        const worktreePrefix = settings.gitWorktreePrefix || 'wt'
        const branchPrefix = settings.gitBranchPrefix || 'feature'
        const worktreeRootPath = settings.gitWorktreeDir || '~/.deskly/worktrees'

        const createdTask = await createTaskWithSideEffects(
          buildTaskCreatePayload({
            createMode,
            title: resolvedTitle,
            prompt: compiledPrompt,
            projectId,
            projectPath,
            createWorktree: Boolean(isGitProject && projectPath),
            baseBranch: isGitProject ? selectedBaseBranch || undefined : undefined,
            worktreePrefix,
            branchPrefix,
            worktreeRootPath,
            cliToolId: resolvedTaskCliToolId || undefined,
            agentToolConfigId: resolvedTaskCliConfigId || undefined,
            workflowDefinitionId: createMode === 'workflow' ? selectedTemplateId : undefined
          })
        )

        return {
          task: createdTask,
          context: {
            prompt: compiledPrompt,
            attachments
          } satisfies CreatedTaskContext
        }
      } catch (createError) {
        console.error('[useTaskComposer] Failed to create task:', createError)
        setError(t.task.createTaskFailed)
        return null
      } finally {
        setLoading(false)
      }
    },
    [
      createMode,
      isGitProject,
      projectId,
      projectName,
      projectPath,
      resolvedTaskCliConfigId,
      resolvedTaskCliToolId,
      selectedBaseBranch,
      selectedTemplateId,
      normalizedPromptNodes,
      projectType,
      t.task.createBaseBranchRequired,
      t.task.createCliConfigRequired,
      t.task.createCliRequired,
      t.task.createPipelineProjectRequired,
      t.task.createPromptRequired,
      t.task.createTaskFailed,
      t.task.createTitleRequired,
      t.task.createWorkflowRequired,
      title,
      titleRequired
    ]
  )

  return {
    title,
    setTitle,
    prompt,
    setPrompt: setPromptValue,
    promptNodes: normalizedPromptNodes,
    setPromptNodes,
    compiledConversationPrompt,
    slashItems,
    slashLoading,
    cliTools,
    selectedCliToolId,
    setSelectedCliToolId,
    cliConfigs,
    selectedCliConfigId,
    setSelectedCliConfigId,
    branches,
    selectedBaseBranch,
    setSelectedBaseBranch,
    workflowDefinitions,
    selectedTemplateId,
    setSelectedTemplateId,
    createMode,
    setCreateMode,
    loading,
    error,
    setError,
    isGitProject,
    createTask
  }
}
