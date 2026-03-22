import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react'
import { Bot, GitBranchPlus, Sparkles, TerminalSquare, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import {
  db,
  type AgentToolConfig,
  type GeneratedWorkflowDefinitionResult,
  type WorkflowDefinitionNodePosition
} from '@/data'
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
  position: WorkflowDefinitionNodePosition
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

interface WorkflowTemplateEditorProps {
  active?: boolean
  initialValues?: WorkflowTemplateFormValues | null
  onSubmit: (values: WorkflowTemplateFormValues) => Promise<void>
  onCancel: () => void
}

const WORKFLOW_NODE_WIDTH = 232
const WORKFLOW_NODE_HEIGHT = 92
const WORKFLOW_NODE_GAP_X = 280
const WORKFLOW_NODE_GAP_Y = 148
const EDGE_ID_SEPARATOR = '::'

type WorkflowEditorNodeData = {
  title: string
  subtitle: string
  nodeType: 'agent' | 'command'
  indexLabel: string
}

type WorkflowEditorNode = Node<WorkflowEditorNodeData, 'workflow-editor'>

const getDefaultNodePosition = (index: number): WorkflowDefinitionNodePosition => ({
  x: (index % 3) * WORKFLOW_NODE_GAP_X,
  y: Math.floor(index / 3) * WORKFLOW_NODE_GAP_Y
})

const normalizeDraftPosition = (
  position: WorkflowDefinitionNodePosition | undefined | null,
  index: number
): WorkflowDefinitionNodePosition => {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return getDefaultNodePosition(index)
  }

  return {
    x: Math.round(position.x),
    y: Math.round(position.y)
  }
}

const createDefaultNode = (index: number): TaskNodeTemplateDraft => ({
  id: newUuid(),
  key: `workflow-node-${index + 1}`,
  type: 'agent',
  name: '',
  prompt: '',
  command: '',
  cliToolId: '',
  agentToolConfigId: '',
  requiresApproval: index === 0,
  dependsOnIds: [],
  position: getDefaultNodePosition(index)
})

const buildEdgeId = (sourceId: string, targetId: string) =>
  `${sourceId}${EDGE_ID_SEPARATOR}${targetId}`

const parseEdgeId = (edgeId: string): { sourceId: string; targetId: string } | null => {
  const [sourceId, targetId] = edgeId.split(EDGE_ID_SEPARATOR)
  if (!sourceId || !targetId) {
    return null
  }

  return { sourceId, targetId }
}

const slugifyWorkflowKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildOutgoingDependencyMap = (nodes: TaskNodeTemplateDraft[]) => {
  const map = new Map<string, string[]>()
  nodes.forEach((node) => {
    map.set(node.id, [])
  })

  nodes.forEach((node) => {
    node.dependsOnIds.forEach((dependencyId) => {
      if (!map.has(dependencyId)) {
        map.set(dependencyId, [])
      }
      map.set(dependencyId, [...(map.get(dependencyId) ?? []), node.id])
    })
  })

  return map
}

const hasPath = (
  outgoing: Map<string, string[]>,
  startId: string,
  targetId: string,
  visited = new Set<string>()
): boolean => {
  if (startId === targetId) return true
  if (visited.has(startId)) return false
  visited.add(startId)

  for (const nextId of outgoing.get(startId) ?? []) {
    if (hasPath(outgoing, nextId, targetId, visited)) {
      return true
    }
  }

  return false
}

const wouldCreateCycle = (
  nodes: TaskNodeTemplateDraft[],
  nodeId: string,
  dependencyId: string
): boolean => {
  if (nodeId === dependencyId) return true
  const outgoing = buildOutgoingDependencyMap(nodes)
  return hasPath(outgoing, nodeId, dependencyId)
}

function WorkflowEditorNodeCard({ data, selected }: NodeProps<WorkflowEditorNode>) {
  const TypeIcon = data.nodeType === 'command' ? TerminalSquare : Bot

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-background/96 px-3 py-3 shadow-sm transition-all',
        'backdrop-blur-[1px]',
        selected
          ? 'border-primary ring-primary/20 ring-2 shadow-primary/10'
          : 'border-border/70 hover:border-primary/35'
      )}
      style={{
        width: WORKFLOW_NODE_WIDTH,
        minHeight: WORKFLOW_NODE_HEIGHT
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-slate-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-slate-400"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <TypeIcon className="size-3.5" />
            <span>{data.nodeType === 'agent' ? 'Agent' : 'Command'}</span>
          </div>
          <div className="truncate text-sm font-semibold">{data.title}</div>
          <p className="text-muted-foreground line-clamp-3 text-xs leading-5">
            {data.subtitle || 'Configure this node from the panel on the right.'}
          </p>
        </div>

        <div className="border-border/60 bg-muted/45 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          {data.indexLabel}
        </div>
      </div>
    </div>
  )
}

const workflowNodeTypes = {
  'workflow-editor': WorkflowEditorNodeCard
}

const buildEditorGraph = (
  nodes: TaskNodeTemplateDraft[],
  workflowNodeLabel: string,
  selectedEdgeId: string | null
): { nodes: WorkflowEditorNode[]; edges: Edge[] } => {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    nodes: nodes.map((node, index) => ({
      id: node.id,
      type: 'workflow-editor',
      position: normalizeDraftPosition(node.position, index),
      data: {
        title: node.name.trim() || `${workflowNodeLabel} ${index + 1}`,
        subtitle:
          node.type === 'agent'
            ? node.prompt.trim() || 'Add an agent prompt'
            : node.command.trim() || 'Add a shell command',
        nodeType: node.type,
        indexLabel: `${index + 1}`
      }
    })),
    edges: nodes.flatMap((node) =>
      node.dependsOnIds
        .filter((dependencyId) => nodeIds.has(dependencyId))
        .map((dependencyId) => {
          const edgeId = buildEdgeId(dependencyId, node.id)
          const selected = edgeId === selectedEdgeId

          return {
            id: edgeId,
            source: dependencyId,
            target: node.id,
            type: 'smoothstep',
            animated: selected,
            selectable: true,
            interactionWidth: 24,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: selected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(148, 163, 184, 0.58)'
            },
            style: {
              stroke: selected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(148, 163, 184, 0.58)',
              strokeWidth: selected ? 2 : 1.4
            }
          } satisfies Edge
        })
    )
  }
}

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
      dependsOnIds: dependencyMap.get(node.id) ?? [],
      position: normalizeDraftPosition(node.position, index)
    }))
  }
}

export function WorkflowTemplateEditor({
  active = true,
  initialValues,
  onSubmit,
  onCancel
}: WorkflowTemplateEditorProps) {
  const { t } = useLanguage()
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateNodes, setTemplateNodes] = useState<TaskNodeTemplateDraft[]>([
    createDefaultNode(0)
  ])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
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
    if (!active) return
    let isMounted = true

    const loadTools = async () => {
      try {
        const detected = await window.api?.cliTools?.getSnapshot?.()
        if (isMounted) setCliTools(normalizeCliTools(detected))
        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch {
        if (isMounted) setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!isMounted) return
      setCliTools(normalizeCliTools(tools))
    })

    void loadTools()

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [active])

  useEffect(() => {
    if (!active) return

    setError(null)
    setGenerationPrompt('')
    setSelectedEdgeId(null)

    if (initialValues) {
      const nextNodes =
        initialValues.nodes.length > 0
          ? initialValues.nodes.map((node, index) => ({
              ...node,
              id: node.id || newUuid(),
              key: node.key || `workflow-node-${node.name || 'node'}`,
              position: normalizeDraftPosition(node.position, index)
            }))
          : [createDefaultNode(0)]

      setTemplateName(initialValues.name)
      setTemplateDescription(initialValues.description || '')
      setTemplateNodes(nextNodes)
      setSelectedNodeId(nextNodes[0]?.id ?? null)
      return
    }

    const firstNode = createDefaultNode(0)
    setTemplateName('')
    setTemplateDescription('')
    setTemplateNodes([firstNode])
    setSelectedNodeId(firstNode.id)
  }, [active, initialValues])

  useEffect(() => {
    if (!active) return

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
  }, [active, loadCliConfigs, templateNodes])

  useEffect(() => {
    if (templateNodes.length === 0) return
    if (!selectedNodeId || !templateNodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(templateNodes[0]?.id ?? null)
    }
  }, [selectedNodeId, templateNodes])

  useEffect(() => {
    if (!selectedEdgeId) return

    const edgeStillExists = templateNodes.some((node) =>
      node.dependsOnIds.some(
        (dependencyId) => buildEdgeId(dependencyId, node.id) === selectedEdgeId
      )
    )

    if (!edgeStillExists) {
      setSelectedEdgeId(null)
    }
  }, [selectedEdgeId, templateNodes])

  const nodeOptions = useMemo(
    () =>
      templateNodes.map((node, index) => ({
        value: node.id,
        label: node.name.trim() || `${t.task.workflowNodeLabel} ${index + 1}`
      })),
    [t.task.workflowNodeLabel, templateNodes]
  )

  const selectedNode = useMemo(
    () => templateNodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, templateNodes]
  )

  const selectedNodeIndex = useMemo(
    () => templateNodes.findIndex((node) => node.id === selectedNodeId),
    [selectedNodeId, templateNodes]
  )

  const selectedEdgeSummary = useMemo(() => {
    if (!selectedEdgeId) return null

    const parsed = parseEdgeId(selectedEdgeId)
    if (!parsed) return null

    const sourceIndex = templateNodes.findIndex((node) => node.id === parsed.sourceId)
    const targetIndex = templateNodes.findIndex((node) => node.id === parsed.targetId)
    const sourceNode = sourceIndex >= 0 ? templateNodes[sourceIndex] : null
    const targetNode = targetIndex >= 0 ? templateNodes[targetIndex] : null

    if (!sourceNode || !targetNode) return null

    return {
      sourceId: parsed.sourceId,
      targetId: parsed.targetId,
      sourceLabel: sourceNode.name.trim() || `${t.task.workflowNodeLabel} ${sourceIndex + 1}`,
      targetLabel: targetNode.name.trim() || `${t.task.workflowNodeLabel} ${targetIndex + 1}`
    }
  }, [selectedEdgeId, t.task.workflowNodeLabel, templateNodes])

  const editorGraph = useMemo(
    () => buildEditorGraph(templateNodes, t.task.workflowNodeLabel, selectedEdgeId),
    [selectedEdgeId, t.task.workflowNodeLabel, templateNodes]
  )

  const updateNode = useCallback(
    (nodeId: string, updater: (node: TaskNodeTemplateDraft) => TaskNodeTemplateDraft) => {
      setTemplateNodes((prev) => prev.map((node) => (node.id === nodeId ? updater(node) : node)))
    },
    []
  )

  const addNode = useCallback(() => {
    const newNode = createDefaultNode(templateNodes.length)
    const anchorNode = templateNodes[templateNodes.length - 1]

    if (anchorNode) {
      const anchorPosition = normalizeDraftPosition(anchorNode.position, templateNodes.length - 1)
      newNode.position = {
        x: anchorPosition.x + 120,
        y: anchorPosition.y + 120
      }
    }

    setTemplateNodes((prev) => [...prev, newNode])
    setSelectedEdgeId(null)
    setSelectedNodeId(newNode.id)
  }, [templateNodes])

  const removeNode = useCallback((nodeId: string) => {
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

    setSelectedEdgeId(null)
    setSelectedNodeId((current) => (current === nodeId ? null : current))
  }, [])

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceId = connection.source
      const targetId = connection.target

      if (!sourceId || !targetId) {
        return
      }

      if (sourceId === targetId) {
        setError('A node cannot depend on itself.')
        return
      }

      const targetNode = templateNodes.find((node) => node.id === targetId)
      if (!targetNode) {
        return
      }

      if (targetNode.dependsOnIds.includes(sourceId)) {
        setError(null)
        setSelectedNodeId(targetId)
        setSelectedEdgeId(buildEdgeId(sourceId, targetId))
        return
      }

      if (wouldCreateCycle(templateNodes, targetId, sourceId)) {
        setError('This connection would create a cycle in the DAG.')
        return
      }

      setTemplateNodes((prev) =>
        prev.map((node) =>
          node.id === targetId ? { ...node, dependsOnIds: [...node.dependsOnIds, sourceId] } : node
        )
      )
      setError(null)
      setSelectedNodeId(targetId)
      setSelectedEdgeId(buildEdgeId(sourceId, targetId))
    },
    [templateNodes]
  )

  const handleRemoveSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return

    const parsed = parseEdgeId(selectedEdgeId)
    if (!parsed) return

    setTemplateNodes((prev) =>
      prev.map((node) =>
        node.id === parsed.targetId
          ? {
              ...node,
              dependsOnIds: node.dependsOnIds.filter(
                (dependencyId) => dependencyId !== parsed.sourceId
              )
            }
          : node
      )
    )

    setSelectedNodeId(parsed.targetId)
    setSelectedEdgeId(null)
  }, [selectedEdgeId])

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
      const nextNodes = draft.nodes.length > 0 ? draft.nodes : [createDefaultNode(0)]

      setTemplateName((current) => current.trim() || draft.name)
      setTemplateDescription((current) => current.trim() || draft.description || '')
      setTemplateNodes(nextNodes)
      setSelectedNodeId(nextNodes[0]?.id ?? null)
      setSelectedEdgeId(null)
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

    const nodes = templateNodes.map((node, index) => {
      const trimmedName = node.name.trim()
      const generatedKey = slugifyWorkflowKey(trimmedName)

      return {
        ...node,
        name: trimmedName || `${t.task.workflowNodeLabel} ${index + 1}`,
        key: node.key.trim() || generatedKey || `workflow-node-${index + 1}`,
        prompt: node.prompt.trim(),
        command: node.command.trim(),
        cliToolId: node.type === 'agent' ? node.cliToolId : '',
        agentToolConfigId: node.type === 'agent' ? node.agentToolConfigId : '',
        dependsOnIds: Array.from(
          new Set((node.dependsOnIds ?? []).filter((dependencyId) => dependencyId !== node.id))
        ),
        position: normalizeDraftPosition(node.position, index)
      }
    })

    if (nodes.length === 0) {
      setError(t.task.createTemplateStageRequired)
      return
    }

    const invalidNode = nodes.find(
      (node) =>
        (node.type === 'agent' && !node.prompt) || (node.type === 'command' && !node.command)
    )
    if (invalidNode) {
      setError(
        t.task.workflowNodeContentRequired || 'Each workflow node needs prompt or command content.'
      )
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
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-medium">{t.task.createTemplateNameLabel}</label>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder={t.task.createTemplateNamePlaceholder}
              className={cn(
                'mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t.task.createTemplateDescriptionLabel}</label>
            <textarea
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder={t.task.createTemplateDescriptionPlaceholder}
              className={cn(
                'mt-1.5 min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4" />
            <span>{t.task.workflowGenerationPromptLabel || 'Generate from goal'}</span>
          </div>
          <textarea
            value={generationPrompt}
            onChange={(event) => setGenerationPrompt(event.target.value)}
            placeholder={
              t.task.workflowGenerationPromptPlaceholder ||
              'Describe the workflow you want to generate.'
            }
            className={cn(
              'min-h-[122px] w-full rounded-md border bg-background px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary'
            )}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Generate a starting DAG, then drag nodes and connect them to refine the flow.
            </p>
            <Button
              type="button"
              variant="outline"
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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-border/60 bg-muted/15">
          <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <GitBranchPlus className="size-4" />
                <span>{t.task.workflowCardTitle || 'Workflow DAG editor'}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Drag nodes to place them. Connect from the right handle into the left handle to
                define dependencies.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addNode}>
                {t.task.addStage}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!selectedEdgeSummary}
                onClick={handleRemoveSelectedEdge}
              >
                Remove selected edge
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-background/90">
            <ReactFlow
              nodes={editorGraph.nodes}
              edges={editorGraph.edges}
              nodeTypes={workflowNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
              minZoom={0.35}
              maxZoom={1.4}
              onConnect={handleConnect}
              onPaneClick={() => setSelectedEdgeId(null)}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id)
                setSelectedEdgeId(null)
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id)
                setSelectedNodeId(edge.target)
              }}
              onNodeDragStop={(_, node) => {
                setTemplateNodes((prev) =>
                  prev.map((draft, index) =>
                    draft.id === node.id
                      ? { ...draft, position: normalizeDraftPosition(node.position, index) }
                      : draft
                  )
                )
              }}
              panOnDrag
              panOnScroll
              nodesDraggable
              nodesConnectable
              elementsSelectable
              zoomOnDoubleClick={false}
              className="bg-transparent"
            >
              <Controls
                position="top-right"
                showInteractive={false}
                className="!shadow-sm [&>button]:!border-border/60 [&>button]:!bg-background/92"
              />
            </ReactFlow>
          </div>

          <div className="border-border/60 flex flex-wrap gap-2 border-t px-3 py-3">
            {nodeOptions.map((option, index) => {
              const node = templateNodes[index]
              const inboundCount = node?.dependsOnIds.length ?? 0
              const outboundCount = templateNodes.filter((item) =>
                item.dependsOnIds.includes(option.value)
              ).length

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(option.value)
                    setSelectedEdgeId(null)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-left text-xs transition-colors',
                    selectedNodeId === option.value
                      ? 'border-primary bg-primary/8 text-primary'
                      : 'border-border/70 bg-background hover:border-primary/35'
                  )}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="text-muted-foreground block text-[11px]">
                    in {inboundCount} / out {outboundCount}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95">
          <div className="border-border/60 border-b px-4 py-3">
            <div className="text-sm font-medium">Node inspector</div>
            <p className="text-muted-foreground mt-1 text-xs">
              Edit the selected node. Dependencies are managed from the graph canvas.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {t.task.workflowNodeLabel} {selectedNodeIndex + 1}
                      </div>
                      <div className="truncate text-sm font-semibold">
                        {selectedNode.name.trim() ||
                          `${t.task.workflowNodeLabel} ${selectedNodeIndex + 1}`}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={templateNodes.length === 1}
                      onClick={() => removeNode(selectedNode.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs">
                    Position: {Math.round(selectedNode.position.x)},{' '}
                    {Math.round(selectedNode.position.y)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{'Node name'}</label>
                  <input
                    value={selectedNode.name}
                    onChange={(event) => {
                      const value = event.target.value
                      updateNode(selectedNode.id, (current) => ({
                        ...current,
                        name: value,
                        key:
                          current.key.startsWith('workflow-node-') && value.trim()
                            ? slugifyWorkflowKey(value) || current.key
                            : current.key
                      }))
                    }}
                    placeholder={t.task.createStageNamePlaceholder}
                    className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">{'Node type'}</label>
                  <div className="mt-1.5">
                    <Select
                      value={selectedNode.type}
                      onValueChange={(value) => {
                        updateNode(selectedNode.id, (current) => ({
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
                </div>

                <div>
                  <label className="text-sm font-medium">
                    {selectedNode.type === 'agent'
                      ? t.task.workflowNodePromptLabel || 'Prompt'
                      : t.task.workflowNodeCommandLabel || 'Command'}
                  </label>
                  <textarea
                    value={
                      selectedNode.type === 'agent' ? selectedNode.prompt : selectedNode.command
                    }
                    onChange={(event) => {
                      const value = event.target.value
                      updateNode(selectedNode.id, (current) =>
                        current.type === 'agent'
                          ? { ...current, prompt: value }
                          : { ...current, command: value }
                      )
                    }}
                    placeholder={
                      selectedNode.type === 'agent'
                        ? t.task.createStagePromptPlaceholder
                        : t.task.workflowNodeCommandPlaceholder || 'Command to run'
                    }
                    className="mt-1.5 min-h-[132px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>

                {selectedNode.type === 'agent' && (
                  <div className="grid gap-3">
                    <div>
                      <label className="text-sm font-medium">{t.task.createCliLabel}</label>
                      <div className="mt-1.5">
                        <Select
                          value={selectedNode.cliToolId || ''}
                          onValueChange={async (toolId) => {
                            let defaultConfigId = ''
                            if (toolId) {
                              const configs =
                                cliConfigsByTool[toolId] || (await loadCliConfigs(toolId))
                              const defaultConfig = configs.find((config) => config.is_default)
                              defaultConfigId = defaultConfig?.id || ''
                            }

                            updateNode(selectedNode.id, (current) => ({
                              ...current,
                              cliToolId: toolId,
                              agentToolConfigId: defaultConfigId
                            }))
                          }}
                          placeholder={t.task.createStageCliInherit}
                          options={cliTools.map((tool) => ({
                            value: tool.id,
                            label: tool.displayName || tool.name || tool.id
                          }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">{t.task.createCliConfigLabel}</label>
                      <div className="mt-1.5">
                        <Select
                          value={selectedNode.agentToolConfigId || ''}
                          disabled={!selectedNode.cliToolId}
                          onValueChange={(configId) => {
                            updateNode(selectedNode.id, (current) => ({
                              ...current,
                              agentToolConfigId: configId
                            }))
                          }}
                          placeholder={
                            !selectedNode.cliToolId
                              ? t.task.createCliConfigSelectTool
                              : t.task.createStageConfigInherit
                          }
                          options={(selectedNode.cliToolId
                            ? cliConfigsByTool[selectedNode.cliToolId] || []
                            : []
                          ).map((config) => ({
                            value: config.id,
                            label: config.name
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="text-sm font-medium">
                    {t.task.workflowDependenciesLabel || 'Dependencies'}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Create dependencies by dragging from one node into another. Click an edge in the
                    graph to remove it.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedNode.dependsOnIds.length > 0 ? (
                      selectedNode.dependsOnIds.map((dependencyId) => {
                        const dependencyIndex = templateNodes.findIndex(
                          (node) => node.id === dependencyId
                        )
                        const dependencyNode =
                          dependencyIndex >= 0 ? templateNodes[dependencyIndex] : null
                        if (!dependencyNode) return null

                        return (
                          <button
                            key={dependencyId}
                            type="button"
                            onClick={() => {
                              setSelectedNodeId(selectedNode.id)
                              setSelectedEdgeId(buildEdgeId(dependencyId, selectedNode.id))
                            }}
                            className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs hover:border-primary/35"
                          >
                            {dependencyNode.name.trim() ||
                              `${t.task.workflowNodeLabel} ${dependencyIndex + 1}`}
                          </button>
                        )
                      })
                    ) : (
                      <div className="text-muted-foreground text-xs">
                        This node has no upstream dependency and can start immediately.
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedNode.requiresApproval}
                    onChange={(event) => {
                      const checked = event.target.checked
                      updateNode(selectedNode.id, (current) => ({
                        ...current,
                        requiresApproval: checked
                      }))
                    }}
                  />
                  <span>{t.task.createStageRequiresApproval}</span>
                </label>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Select a node from the graph to edit it.
              </div>
            )}
          </div>

          <div className="border-border/60 border-t px-4 py-3">
            {selectedEdgeSummary ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <div className="text-xs font-medium">Selected edge</div>
                <div className="mt-1 text-sm">
                  {selectedEdgeSummary.sourceLabel} → {selectedEdgeSummary.targetLabel}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-xs">
                Select an edge on the canvas if you want to remove that dependency.
              </div>
            )}
          </div>
        </aside>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.task.createLoading : t.task.saveTemplate}
        </Button>
      </div>
    </form>
  )
}

export function WorkflowTemplateDialog({
  open,
  onOpenChange,
  title,
  initialValues,
  onSubmit
}: WorkflowTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <WorkflowTemplateEditor
          active={open}
          initialValues={initialValues}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (values) => {
            await onSubmit(values)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
