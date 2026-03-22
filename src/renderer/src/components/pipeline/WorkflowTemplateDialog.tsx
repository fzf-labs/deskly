import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { db, type AgentToolConfig, type GeneratedWorkflowDefinitionResult } from '@/data'
import { newUuid } from '@/lib/ids'
import { normalizeCliTools, type CLIToolInfo } from '@/lib/cli-tools'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

export interface TaskNodeTemplateDraft {
  id: string
  key: string
  type: 'agent' | 'command'
  name: string
  prompt: string
  command: string
  cliToolId: string
  agentToolConfigId: string
  requiresApproval: boolean
  dependsOnIds: string[]
}

export interface WorkflowTemplateFormValues {
  name: string
  description?: string
  nodes: TaskNodeTemplateDraft[]
}

interface WorkflowTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialValues?: WorkflowTemplateFormValues | null
  onSubmit: (values: WorkflowTemplateFormValues) => Promise<void>
}

const createDefaultNode = (
  index: number,
  previousNodeId?: string | null
): TaskNodeTemplateDraft => ({
  id: newUuid(),
  key: `workflow-node-${index + 1}`,
  type: 'agent',
  name: '',
  prompt: '',
  command: '',
  cliToolId: '',
  agentToolConfigId: '',
  requiresApproval: index === 0,
  dependsOnIds: previousNodeId ? [previousNodeId] : []
})

const mapGeneratedDefinitionToDrafts = (
  generated: GeneratedWorkflowDefinitionResult
): WorkflowTemplateFormValues => {
  const dependencyMap = new Map<string, string[]>()
  generated.definition.edges.forEach((edge) => {
    dependencyMap.set(edge.to, [...(dependencyMap.get(edge.to) ?? []), edge.from])
  })

  return {
    name: generated.name,
    description: generated.description ?? undefined,
    nodes: generated.definition.nodes.map((node, index) => ({
      id: node.id,
      key: node.key || `workflow-node-${index + 1}`,
      type: node.type,
      name: node.name,
      prompt: node.prompt ?? '',
      command: node.command ?? '',
      cliToolId: node.cliToolId ?? '',
      agentToolConfigId: node.agentToolConfigId ?? '',
      requiresApproval: Boolean(node.requiresApprovalAfterRun),
      dependsOnIds: dependencyMap.get(node.id) ?? []
    }))
  }
}

export function WorkflowTemplateDialog({
  open,
  onOpenChange,
  title,
  initialValues,
  onSubmit
}: WorkflowTemplateDialogProps) {
  const { t } = useLanguage()
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateNodes, setTemplateNodes] = useState<TaskNodeTemplateDraft[]>([
    createDefaultNode(0)
  ])
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])
  const [cliConfigsByTool, setCliConfigsByTool] = useState<Record<string, AgentToolConfig[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadCliConfigs = useCallback(
    async (toolId: string): Promise<AgentToolConfig[]> => {
      if (!toolId) return []
      const cached = cliConfigsByTool[toolId]
      if (cached) return cached

      try {
        const result = await db.listAgentToolConfigs(toolId)
        const list = Array.isArray(result) ? (result as AgentToolConfig[]) : []
        setCliConfigsByTool((prev) => (prev[toolId] ? prev : { ...prev, [toolId]: list }))
        return list
      } catch {
        setCliConfigsByTool((prev) => (prev[toolId] ? prev : { ...prev, [toolId]: [] }))
        return []
      }
    },
    [cliConfigsByTool]
  )

  useEffect(() => {
    if (!open) return
    let active = true

    const loadTools = async () => {
      try {
        const detected = await window.api?.cliTools?.getSnapshot?.()
        if (active) setCliTools(normalizeCliTools(detected))
        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch {
        if (active) setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!active) return
      setCliTools(normalizeCliTools(tools))
    })

    void loadTools()

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    setError(null)
    setGenerationPrompt('')

    if (initialValues) {
      setTemplateName(initialValues.name)
      setTemplateDescription(initialValues.description || '')
      setTemplateNodes(
        initialValues.nodes.length > 0
          ? initialValues.nodes.map((node) => ({
              ...node,
              id: node.id || newUuid(),
              key: node.key || `workflow-node-${node.name || 'node'}`
            }))
          : [createDefaultNode(0)]
      )
      return
    }

    setTemplateName('')
    setTemplateDescription('')
    setTemplateNodes([createDefaultNode(0)])
  }, [open, initialValues])

  useEffect(() => {
    if (!open) return

    const toolIds = Array.from(
      new Set(
        templateNodes
          .filter((node) => node.type === 'agent')
          .map((node) => node.cliToolId)
          .filter((toolId): toolId is string => Boolean(toolId))
      )
    )

    toolIds.forEach((toolId) => {
      void loadCliConfigs(toolId)
    })
  }, [loadCliConfigs, open, templateNodes])

  const nodeOptions = useMemo(
    () =>
      templateNodes.map((node, index) => ({
        value: node.id,
        label: node.name.trim() || `${t.task.workflowNodeLabel} ${index + 1}`
      })),
    [t.task.workflowNodeLabel, templateNodes]
  )

  const updateNode = (nodeId: string, updater: (node: TaskNodeTemplateDraft) => TaskNodeTemplateDraft) => {
    setTemplateNodes((prev) => prev.map((node) => (node.id === nodeId ? updater(node) : node)))
  }

  const moveNode = (fromIndex: number, toIndex: number) => {
    setTemplateNodes((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return prev
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const removeNode = (nodeId: string) => {
    setTemplateNodes((prev) => {
      const next = prev.filter((node) => node.id !== nodeId)
      if (next.length === 0) {
        return [createDefaultNode(0)]
      }

      return next.map((node) => ({
        ...node,
        dependsOnIds: node.dependsOnIds.filter((dependencyId) => dependencyId !== nodeId)
      }))
    })
  }

  const handleGenerate = async () => {
    if (!generationPrompt.trim()) {
      setError(t.task.workflowGenerationPromptRequired || 'Please enter a workflow goal first.')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const generated = await db.generateWorkflowDefinition({
        prompt: generationPrompt.trim(),
        name: templateName.trim() || undefined
      })
      const draft = mapGeneratedDefinitionToDrafts(generated)
      setTemplateName((current) => current.trim() || draft.name)
      setTemplateDescription((current) => current.trim() || draft.description || '')
      setTemplateNodes(draft.nodes.length > 0 ? draft.nodes : [createDefaultNode(0)])
    } catch (err) {
      setError(String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!templateName.trim()) {
      setError(t.task.createTemplateNameRequired)
      return
    }

    const nodes = templateNodes.map((node, index) => ({
      ...node,
      name: node.name.trim() || `${t.task.workflowNodeLabel} ${index + 1}`,
      key: node.key.trim() || `workflow-node-${index + 1}`,
      prompt: node.prompt.trim(),
      command: node.command.trim(),
      cliToolId: node.type === 'agent' ? node.cliToolId : '',
      agentToolConfigId: node.type === 'agent' ? node.agentToolConfigId : '',
      dependsOnIds: (node.dependsOnIds ?? []).filter((dependencyId) => dependencyId !== node.id)
    }))

    if (nodes.length === 0) {
      setError(t.task.createTemplateStageRequired)
      return
    }

    const invalidNode = nodes.find(
      (node) =>
        (node.type === 'agent' && !node.prompt) || (node.type === 'command' && !node.command)
    )
    if (invalidNode) {
      setError(t.task.workflowNodeContentRequired || 'Each workflow node needs prompt or command content.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: WorkflowTemplateFormValues = {
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        nodes
      }
      await onSubmit(payload)
      onOpenChange(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
          <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
            <div>
              <label className="text-sm font-medium">{t.task.createTemplateNameLabel}</label>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t.task.createTemplateNamePlaceholder}
                className={cn(
                  'mt-1.5 w-full px-3 py-2 text-sm',
                  'bg-background border rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-primary'
                )}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t.task.workflowGenerationPromptLabel || 'Generate from goal'}</label>
              <div className="mt-1.5 flex gap-2">
                <textarea
                  value={generationPrompt}
                  onChange={(event) => setGenerationPrompt(event.target.value)}
                  placeholder={
                    t.task.workflowGenerationPromptPlaceholder ||
                    'Describe the workflow you want to generate.'
                  }
                  className={cn(
                    'min-h-[84px] flex-1 px-3 py-2 text-sm',
                    'bg-background border rounded-md',
                    'focus:outline-none focus:ring-2 focus:ring-primary'
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating
                    ? t.task.workflowGenerateLoading || 'Generating...'
                    : t.task.workflowGenerateButton || 'Generate'}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{t.task.createTemplateDescriptionLabel}</label>
            <textarea
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder={t.task.createTemplateDescriptionPlaceholder}
              className={cn(
                'mt-1.5 w-full min-h-[72px] px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col space-y-3">
            <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden space-y-3 pr-1">
              {templateNodes.map((node, index) => {
                const dependencyCandidates = nodeOptions.filter((candidate) => candidate.value !== node.id)

                return (
                  <div key={node.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium">
                        {t.task.workflowNodeLabel} {index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => moveNode(index, index - 1)}
                        >
                          {t.task.workflowMoveUp || 'Up'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === templateNodes.length - 1}
                          onClick={() => moveNode(index, index + 1)}
                        >
                          {t.task.workflowMoveDown || 'Down'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNode(node.id)}
                        >
                          {t.common.remove}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,180px]">
                      <input
                        value={node.name}
                        onChange={(event) => {
                          const value = event.target.value
                          updateNode(node.id, (current) => ({
                            ...current,
                            name: value,
                            key:
                              current.key.startsWith('workflow-node-') && value.trim()
                                ? value
                                    .trim()
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-+|-+$/g, '') || current.key
                                : current.key
                          }))
                        }}
                        placeholder={t.task.createStageNamePlaceholder}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      <Select
                        value={node.type}
                        onValueChange={(value) => {
                          updateNode(node.id, (current) => ({
                            ...current,
                            type: value as 'agent' | 'command',
                            cliToolId: value === 'agent' ? current.cliToolId : '',
                            agentToolConfigId: value === 'agent' ? current.agentToolConfigId : ''
                          }))
                        }}
                        options={[
                          {
                            value: 'agent',
                            label: t.task.workflowNodeTypeAgent || 'Agent'
                          },
                          {
                            value: 'command',
                            label: t.task.workflowNodeTypeCommand || 'Command'
                          }
                        ]}
                      />
                    </div>

                    <div className="mt-3">
                      <label className="text-xs font-medium text-muted-foreground">
                        {node.type === 'agent'
                          ? t.task.workflowNodePromptLabel || 'Prompt'
                          : t.task.workflowNodeCommandLabel || 'Command'}
                      </label>
                      <textarea
                        value={node.type === 'agent' ? node.prompt : node.command}
                        onChange={(event) => {
                          const value = event.target.value
                          updateNode(node.id, (current) =>
                            current.type === 'agent'
                              ? { ...current, prompt: value }
                              : { ...current, command: value }
                          )
                        }}
                        placeholder={
                          node.type === 'agent'
                            ? t.task.createStagePromptPlaceholder
                            : t.task.workflowNodeCommandPlaceholder || 'Command to run'
                        }
                        className="mt-1.5 w-full rounded-md border bg-background px-2 py-2 text-sm"
                      />
                    </div>

                    {node.type === 'agent' && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            {t.task.createCliLabel}
                          </label>
                          <Select
                            value={node.cliToolId || ''}
                            onValueChange={async (toolId) => {
                              let defaultConfigId = ''
                              if (toolId) {
                                const configs = cliConfigsByTool[toolId] || (await loadCliConfigs(toolId))
                                const defaultConfig = configs.find((config) => config.is_default)
                                defaultConfigId = defaultConfig?.id || ''
                              }

                              updateNode(node.id, (current) => ({
                                ...current,
                                cliToolId: toolId,
                                agentToolConfigId: defaultConfigId
                              }))
                            }}
                            triggerClassName="mt-1.5 h-9 px-2"
                            placeholder={t.task.createStageCliInherit}
                            options={cliTools.map((tool) => ({
                              value: tool.id,
                              label: tool.displayName || tool.name || tool.id
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            {t.task.createCliConfigLabel}
                          </label>
                          <Select
                            value={node.agentToolConfigId || ''}
                            disabled={!node.cliToolId}
                            onValueChange={(configId) => {
                              updateNode(node.id, (current) => ({
                                ...current,
                                agentToolConfigId: configId
                              }))
                            }}
                            triggerClassName="mt-1.5 h-9 px-2"
                            placeholder={
                              !node.cliToolId
                                ? t.task.createCliConfigSelectTool
                                : t.task.createStageConfigInherit
                            }
                            options={(node.cliToolId ? cliConfigsByTool[node.cliToolId] || [] : []).map(
                              (config) => ({
                                value: config.id,
                                label: config.name
                              })
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.task.workflowDependenciesLabel || 'Dependencies'}
                      </label>
                      {dependencyCandidates.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {t.task.workflowDependenciesEmpty || 'This node can start immediately.'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dependencyCandidates.map((candidate) => {
                            const checked = node.dependsOnIds.includes(candidate.value)
                            return (
                              <label
                                key={candidate.value}
                                className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    const nextChecked = event.target.checked
                                    updateNode(node.id, (current) => ({
                                      ...current,
                                      dependsOnIds: nextChecked
                                        ? [...current.dependsOnIds, candidate.value]
                                        : current.dependsOnIds.filter(
                                            (dependencyId) => dependencyId !== candidate.value
                                          )
                                    }))
                                  }}
                                />
                                <span>{candidate.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={node.requiresApproval}
                          onChange={(event) => {
                            const checked = event.target.checked
                            updateNode(node.id, (current) => ({
                              ...current,
                              requiresApproval: checked
                            }))
                          }}
                        />
                        {t.task.createStageRequiresApproval}
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setTemplateNodes((prev) => [
                  ...prev,
                  createDefaultNode(prev.length, prev[prev.length - 1]?.id ?? null)
                ])
              }
            >
              {t.task.addStage}
            </Button>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t.task.createLoading : t.task.saveTemplate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
