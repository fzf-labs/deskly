import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles } from 'lucide-react'

import type { MessageAttachment } from '@/hooks/useAgent'
import { ChatInput } from '@/components/shared/ChatInput'
import {
  TaskCreateMenu,
  type TaskMode,
  type TaskMenuCliToolInfo,
  type TaskMenuWorkflowTemplate
} from '@/components/task/TaskCreateMenu'
import { db, type AgentToolConfig } from '@/data'
import { getSettings } from '@/data/settings'
import { useProjects } from '@/hooks/useProjects'
import { normalizeCliTools } from '@/lib/cli-tools'
import { useLanguage } from '@/providers/language-provider'

export function TasksPage() {
  const navigate = useNavigate()
  const { currentProject } = useProjects()
  const { t } = useLanguage()

  const [cliTools, setCliTools] = useState<TaskMenuCliToolInfo[]>([])
  const [selectedCliToolId, setSelectedCliToolId] = useState('')
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([])
  const [selectedCliConfigId, setSelectedCliConfigId] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBaseBranch, setSelectedBaseBranch] = useState('')
  const [workflowTemplates, setWorkflowTemplates] = useState<TaskMenuWorkflowTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [taskMode, setTaskMode] = useState<TaskMode>('conversation')

  const isGitProject = currentProject?.projectType === 'git'

  useEffect(() => {
    let active = true
    const loadCliTools = async () => {
      try {
        const detected = await window.api?.cliTools?.getSnapshot?.()
        const tools = normalizeCliTools(detected) as TaskMenuCliToolInfo[]
        if (!active) return
        setCliTools(tools)

        const settings = getSettings()
        if (settings.defaultCliToolId) {
          const hasDefault = tools.some((tool) => tool.id === settings.defaultCliToolId)
          if (hasDefault) setSelectedCliToolId(settings.defaultCliToolId)
        }

        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch (error) {
        if (!active) return
        console.error('[TasksPage] Failed to load CLI tools:', error)
        setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!active) return
      setCliTools(normalizeCliTools(tools) as TaskMenuCliToolInfo[])
    })

    void loadCliTools()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!selectedCliToolId) {
      setCliConfigs([])
      setSelectedCliConfigId('')
      return
    }

    let active = true
    const loadConfigs = async () => {
      try {
        const result = await db.listAgentToolConfigs(selectedCliToolId)
        const list = Array.isArray(result) ? (result as AgentToolConfig[]) : []
        if (!active) return
        setCliConfigs(list)
        const defaultConfig = list.find((cfg) => cfg.is_default)
        setSelectedCliConfigId(defaultConfig?.id || '')
      } catch (error) {
        if (!active) return
        console.error('[TasksPage] Failed to load CLI configs:', error)
        setCliConfigs([])
        setSelectedCliConfigId('')
      }
    }

    void loadConfigs()
    return () => {
      active = false
    }
  }, [selectedCliToolId])

  useEffect(() => {
    if (!currentProject?.id) {
      setWorkflowTemplates([])
      setSelectedTemplateId('')
      return
    }

    let active = true
    const loadTemplates = async () => {
      try {
        const templates = await db.getWorkflowTemplatesByProject(currentProject.id)
        const list = Array.isArray(templates) ? (templates as TaskMenuWorkflowTemplate[]) : []
        if (!active) return
        setWorkflowTemplates(list)
        if (selectedTemplateId && !list.some((tpl) => tpl.id === selectedTemplateId)) {
          setSelectedTemplateId('')
        }
      } catch (error) {
        if (!active) return
        console.error('[TasksPage] Failed to load workflow templates:', error)
        setWorkflowTemplates([])
      }
    }

    void loadTemplates()
    return () => {
      active = false
    }
  }, [currentProject?.id, selectedTemplateId])

  useEffect(() => {
    if (taskMode !== 'workflow') return
    if (workflowTemplates.length === 0) {
      if (selectedTemplateId) setSelectedTemplateId('')
      return
    }
    const exists = workflowTemplates.some((template) => template.id === selectedTemplateId)
    if (!exists) {
      setSelectedTemplateId(workflowTemplates[0].id)
    }
  }, [selectedTemplateId, taskMode, workflowTemplates])

  useEffect(() => {
    if (!isGitProject || !currentProject?.path) {
      setBranches([])
      setSelectedBaseBranch('')
      return
    }

    let active = true
    const loadBranches = async () => {
      try {
        const [branchesResult, currentResult] = await Promise.all([
          window.api?.git?.getBranches?.(currentProject.path),
          window.api?.git?.getCurrentBranch?.(currentProject.path)
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

        if (!active) return
        setBranches(branchList)
        if (currentBranch && branchList.includes(currentBranch)) {
          setSelectedBaseBranch(currentBranch)
        } else if (branchList.length > 0) {
          setSelectedBaseBranch(branchList[0])
        } else {
          setSelectedBaseBranch('')
        }
      } catch (error) {
        if (!active) return
        console.error('[TasksPage] Failed to load branches:', error)
        setBranches([])
        setSelectedBaseBranch('')
      }
    }

    void loadBranches()
    return () => {
      active = false
    }
  }, [currentProject?.path, isGitProject])

  const handleSubmit = useCallback(
    async (text: string, attachments?: MessageAttachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return

      const settings = getSettings()
      const resolvedCliToolId = selectedCliToolId || settings.defaultCliToolId || ''
      const resolvedCliConfigId =
        selectedCliConfigId || cliConfigs.find((config) => config.is_default)?.id || ''
      if (taskMode === 'conversation' && (!resolvedCliToolId || !resolvedCliConfigId)) {
        return
      }
      if (taskMode === 'workflow' && !selectedTemplateId) {
        return
      }
      if (isGitProject && !selectedBaseBranch) {
        return
      }

      const prompt = text.trim()
      const title =
        prompt
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean)
          ?.slice(0, 80) || 'New thread'

      try {
        const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'VW-'
        const worktreeRootPath = settings.gitWorktreeDir || '~/.deskly/worktrees'

        const result = await window.api.task.create({
          title,
          prompt,
          taskMode,
          projectId: currentProject?.id,
          projectPath: currentProject?.path,
          createWorktree: Boolean(isGitProject && currentProject?.path),
          baseBranch: isGitProject ? selectedBaseBranch || undefined : undefined,
          worktreeBranchPrefix,
          worktreeRootPath,
          cliToolId: taskMode === 'conversation' ? resolvedCliToolId : undefined,
          agentToolConfigId: taskMode === 'conversation' ? resolvedCliConfigId : undefined,
          workflowTemplateId: taskMode === 'workflow' ? selectedTemplateId : undefined
        })

        if (result.success && result.data) {
          navigate(`/task/${result.data.id}`, { state: { prompt, attachments } })
        }
      } catch (error) {
        console.error('[TasksPage] Failed to create task:', error)
      }
    },
    [
      cliConfigs,
      currentProject?.id,
      currentProject?.path,
      isGitProject,
      navigate,
      selectedBaseBranch,
      selectedCliConfigId,
      selectedCliToolId,
      selectedTemplateId,
      taskMode
    ]
  )

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_26%),linear-gradient(180deg,#fbfcff_0%,#f5f7fb_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0))]" />

      <div className="relative flex flex-1 flex-col overflow-auto px-6 py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
          <div className="mb-10 flex flex-col items-center gap-5 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/92 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Bot className="size-3.5" />
              <span>{currentProject?.name || 'Deskly workspace'}</span>
            </div>
            <div className="flex size-16 items-center justify-center rounded-[22px] border border-white/80 bg-white/88 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <Sparkles className="size-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
                {t.home.welcomeTitle}
              </h1>
              <p className="text-muted-foreground text-lg font-medium md:text-xl">
                {currentProject?.path || 'A calmer coding workspace for your projects'}
              </p>
            </div>
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              {t.home.welcomeSubtitle}
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <ChatInput
              variant="home"
              placeholder={t.home.inputPlaceholder}
              onSubmit={handleSubmit}
              className="w-full"
              autoFocus
              operationBar={
                <TaskCreateMenu
                  taskMode={taskMode}
                  onTaskModeChange={setTaskMode}
                  canUseWorkflowMode={Boolean(currentProject?.id)}
                  cliTools={cliTools}
                  selectedCliToolId={selectedCliToolId}
                  onSelectCliToolId={setSelectedCliToolId}
                  cliConfigs={cliConfigs}
                  selectedCliConfigId={selectedCliConfigId}
                  onSelectCliConfigId={setSelectedCliConfigId}
                  workflowTemplates={workflowTemplates}
                  selectedTemplateId={selectedTemplateId}
                  onSelectTemplateId={setSelectedTemplateId}
                  isGitProject={Boolean(isGitProject)}
                  branches={branches}
                  selectedBaseBranch={selectedBaseBranch}
                  onSelectBaseBranch={setSelectedBaseBranch}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
