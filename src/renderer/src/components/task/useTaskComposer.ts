import { useCallback, useEffect, useState } from 'react'

import { db, type AgentToolConfig } from '@/data'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'
import type { MessageAttachment } from '@/hooks/useAgent'
import { filterEnabledCliTools } from '@/lib/agent-cli-tool-enablement'
import { normalizeCliTools, type CLIToolInfo } from '@/lib/agent-cli-tools'
import { notifyTasksChanged } from '@/lib/task-events'
import { useLanguage } from '@/providers/language-provider'

import type { TaskMode } from './TaskCreateMenu'

interface UseTaskComposerOptions {
  active?: boolean
  resetOnActivate?: boolean
  projectId?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  titleRequired?: boolean
}

interface CreatedTaskContext {
  prompt: string
  attachments?: MessageAttachment[]
}

export function useTaskComposer({
  active = true,
  resetOnActivate = false,
  projectId,
  projectPath,
  projectType = 'normal',
  titleRequired = false
}: UseTaskComposerOptions) {
  const { t } = useLanguage()

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])
  const [selectedCliToolId, setSelectedCliToolId] = useState('')
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([])
  const [selectedCliConfigId, setSelectedCliConfigId] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBaseBranch, setSelectedBaseBranch] = useState('')
  const [workflowDefinitions, setWorkflowDefinitions] = useState<Array<{ id: string; name: string }>>(
    []
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [taskMode, setTaskMode] = useState<TaskMode>('conversation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGitProject = projectType === 'git'

  useEffect(() => {
    if (!active || !resetOnActivate) return

    setError(null)
    setTitle('')
    setPrompt('')
    setTaskMode('conversation')
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
        const hasSelectedConfig = selectedCliConfigId && list.some((cfg) => cfg.id === selectedCliConfigId)
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
          ...((Array.isArray(globalDefinitions)
            ? (globalDefinitions as Array<{ id: string; name: string }>)
            : []
          ).map((definition) => ({
            id: definition.id,
            name: `${definition.name}（全局）`
          })))
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
    if (taskMode !== 'workflow') return
    if (workflowDefinitions.length === 0) {
      if (selectedTemplateId) setSelectedTemplateId('')
      return
    }
    const exists = workflowDefinitions.some((template) => template.id === selectedTemplateId)
    if (!exists) {
      setSelectedTemplateId(workflowDefinitions[0]!.id)
    }
  }, [selectedTemplateId, taskMode, workflowDefinitions])

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

  const createTask = useCallback(
    async (text: string, attachments?: MessageAttachment[]) => {
      const trimmedPrompt = text.trim()
      const trimmedTitle = title.trim()

      if (!trimmedPrompt && (!attachments || attachments.length === 0)) {
        setError(t.task.createPromptRequired)
        return null
      }

      if (titleRequired && !trimmedTitle) {
        setError(t.task.createTitleRequired)
        return null
      }

      const settings = getSettings()
      const resolvedCliToolId = selectedCliToolId || getEnabledDefaultCliToolId(settings) || ''
      const resolvedCliConfigId =
        selectedCliConfigId || cliConfigs.find((config) => config.is_default)?.id || ''

      if (taskMode === 'conversation') {
        if (!resolvedCliToolId) {
          setError(t.task.createCliRequired)
          return null
        }
        if (!resolvedCliConfigId) {
          setError(t.task.createCliConfigRequired)
          return null
        }
      }

      if (taskMode === 'workflow') {
        if (!projectId) {
          setError(t.task.createPipelineProjectRequired)
          return null
        }
        if (!selectedTemplateId) {
          setError(t.task.createWorkflowRequired)
          return null
        }
      }

      if (isGitProject && !selectedBaseBranch) {
        setError(t.task.createBaseBranchRequired)
        return null
      }

      setLoading(true)
      setError(null)

      const derivedTitle =
        trimmedPrompt
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean)
          ?.slice(0, 80) || 'New thread'

      try {
        const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'WT-'
        const worktreeRootPath = settings.gitWorktreeDir || '~/.deskly/worktrees'

        const createdTask = await window.api.task.create({
          title: titleRequired ? trimmedTitle : derivedTitle,
          prompt: trimmedPrompt,
          taskMode,
          projectId,
          projectPath,
          createWorktree: Boolean(isGitProject && projectPath),
          baseBranch: isGitProject ? selectedBaseBranch || undefined : undefined,
          worktreeBranchPrefix,
          worktreeRootPath,
          cliToolId: taskMode === 'conversation' ? resolvedCliToolId : undefined,
          agentToolConfigId: taskMode === 'conversation' ? resolvedCliConfigId : undefined,
          workflowDefinitionId: taskMode === 'workflow' ? selectedTemplateId : undefined
        })

        notifyTasksChanged()

        return {
          task: createdTask,
          context: {
            prompt: trimmedPrompt,
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
      cliConfigs,
      isGitProject,
      projectId,
      projectPath,
      selectedBaseBranch,
      selectedCliConfigId,
      selectedCliToolId,
      selectedTemplateId,
      t.task.createBaseBranchRequired,
      t.task.createCliConfigRequired,
      t.task.createCliRequired,
      t.task.createPipelineProjectRequired,
      t.task.createPromptRequired,
      t.task.createTaskFailed,
      t.task.createTitleRequired,
      t.task.createWorkflowRequired,
      taskMode,
      title,
      titleRequired
    ]
  )

  return {
    title,
    setTitle,
    prompt,
    setPrompt,
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
    taskMode,
    setTaskMode,
    loading,
    error,
    setError,
    isGitProject,
    createTask
  }
}
