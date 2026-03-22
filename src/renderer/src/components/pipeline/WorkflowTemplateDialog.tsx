import {
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from '@xyflow/react'
import dagre from 'dagre'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranchPlus,
  LayoutTemplate,
  Save,
  Sparkles,
  Settings2,
  TerminalSquare,
  Trash2,
  ScanSearch
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'

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
import { filterEnabledCliTools } from '@/lib/cli-tool-enablement'
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
const WORKFLOW_LAYOUT_NODE_WIDTH = 260
const WORKFLOW_LAYOUT_NODE_HEIGHT = 164
const WORKFLOW_LAYOUT_NODE_SPACING_Y = WORKFLOW_LAYOUT_NODE_HEIGHT + 36
const WORKFLOW_NODE_GAP_X = 280
const WORKFLOW_NODE_GAP_Y = 148
const EDGE_ID_SEPARATOR = '::'
const EDITOR_INPUT_CLASS =
  'mt-1.5 w-full rounded-[6px] border border-slate-200/80 bg-white px-3 py-2.5 text-sm focus:border-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
const EDITOR_TEXTAREA_CLASS =
  'mt-1.5 w-full rounded-[6px] border border-slate-200/80 bg-white px-3 py-2.5 text-sm focus:border-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
const EDITOR_SECTION_CLASS =
  'rounded-[4px] border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
const EDITOR_BADGE_CLASS =
  'rounded-[4px] border border-slate-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-medium text-slate-600'
const EDITOR_TOOLBAR_GROUP_CLASS =
  'flex items-center gap-1 rounded-[6px] border border-slate-200/80 bg-white/88 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
const EDITOR_RAIL_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-[6px] border border-slate-200/80 bg-white/88 text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors hover:bg-white hover:text-slate-900'
const EDITOR_PANEL_HEADER_CLASS = 'border-b border-slate-200/70 px-4 py-4 backdrop-blur'
const EDITOR_SELECT_TRIGGER_CLASS = 'rounded-[6px]'

type WorkflowEditorNodeData = {
  title: string
  subtitle: string
  nodeType: 'agent' | 'command'
  indexLabel: string
  inboundCount: number
  outboundCount: number
  requiresApproval: boolean
}

type WorkflowEditorNode = Node<WorkflowEditorNodeData, 'workflow-editor'>

const isWorkflowGenerationCliTool = (tool: CLIToolInfo) =>
  tool.id === 'claude-code' || tool.id === 'codex'

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

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable)

const serializeDrafts = (values: WorkflowTemplateFormValues) =>
  JSON.stringify({
    name: values.name.trim(),
    description: values.description?.trim() || '',
    nodes: values.nodes.map((node, index) => ({
      id: node.id,
      key: node.key.trim() || `workflow-node-${index + 1}`,
      type: node.type,
      name: node.name.trim(),
      prompt: node.prompt.trim(),
      command: node.command.trim(),
      cliToolId: node.cliToolId || '',
      agentToolConfigId: node.agentToolConfigId || '',
      requiresApproval: Boolean(node.requiresApproval),
      dependsOnIds: [...new Set(node.dependsOnIds ?? [])].sort(),
      position: normalizeDraftPosition(node.position, index)
    }))
  })

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

const buildAutoLayoutPositions = (nodes: TaskNodeTemplateDraft[]) => {
  if (nodes.length === 0) {
    return new Map<string, WorkflowDefinitionNodePosition>()
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = buildOutgoingDependencyMap(nodes)
  const incomingById = new Map<string, string[]>()

  nodes.forEach((node) => {
    incomingById.set(
      node.id,
      node.dependsOnIds.filter((dependencyId) => nodesById.has(dependencyId))
    )
  })

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    align: 'UL',
    ranksep: 168,
    nodesep: 92,
    edgesep: 24,
    marginx: 40,
    marginy: 40
  })

  const orderedNodes = [...nodes].sort((leftNode, rightNode) => {
    const leftPosition = normalizeDraftPosition(
      leftNode.position,
      nodes.findIndex((node) => node.id === leftNode.id)
    )
    const rightPosition = normalizeDraftPosition(
      rightNode.position,
      nodes.findIndex((node) => node.id === rightNode.id)
    )

    if (leftPosition.y !== rightPosition.y) {
      return leftPosition.y - rightPosition.y
    }

    return leftPosition.x - rightPosition.x
  })

  orderedNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: WORKFLOW_LAYOUT_NODE_WIDTH,
      height: WORKFLOW_LAYOUT_NODE_HEIGHT
    })
  })

  orderedNodes.forEach((node) => {
    node.dependsOnIds
      .filter((dependencyId) => nodesById.has(dependencyId))
      .forEach((dependencyId) => {
        graph.setEdge(dependencyId, node.id)
      })
  })

  dagre.layout(graph)

  const centerById = new Map<string, { x: number; y: number }>()
  const columnGroups = new Map<number, string[]>()

  orderedNodes.forEach((node) => {
    const layoutNode = graph.node(node.id) as { x: number; y: number } | undefined

    if (!layoutNode) {
      return
    }

    const center = {
      x: layoutNode.x,
      y: layoutNode.y
    }
    centerById.set(node.id, center)

    const columnKey = Math.round(layoutNode.x)
    columnGroups.set(columnKey, [...(columnGroups.get(columnKey) ?? []), node.id])
  })

  const getNeighborAverageCenterY = (nodeIds: string[]) => {
    const centers = nodeIds
      .map((nodeId) => centerById.get(nodeId)?.y)
      .filter((value): value is number => typeof value === 'number')

    if (centers.length === 0) {
      return null
    }

    return centers.reduce((sum, value) => sum + value, 0) / centers.length
  }

  const getIdealCenterY = (nodeId: string) => {
    const currentCenter = centerById.get(nodeId)?.y ?? 0
    const incomingAverage = getNeighborAverageCenterY(incomingById.get(nodeId) ?? [])
    const outgoingAverage = getNeighborAverageCenterY(outgoing.get(nodeId) ?? [])

    if (incomingAverage !== null && outgoingAverage !== null) {
      return (incomingAverage + outgoingAverage) / 2
    }

    return incomingAverage ?? outgoingAverage ?? currentCenter
  }

  const redistributeColumn = (nodeIds: string[]) => {
    if (nodeIds.length === 0) return

    const orderedNodeIds = [...nodeIds].sort((leftId, rightId) => {
      const leftIdeal = getIdealCenterY(leftId)
      const rightIdeal = getIdealCenterY(rightId)

      if (leftIdeal !== rightIdeal) {
        return leftIdeal - rightIdeal
      }

      return (centerById.get(leftId)?.y ?? 0) - (centerById.get(rightId)?.y ?? 0)
    })

    if (orderedNodeIds.length === 1) {
      const nodeId = orderedNodeIds[0]
      const currentCenter = centerById.get(nodeId)

      if (currentCenter) {
        centerById.set(nodeId, {
          x: currentCenter.x,
          y: getIdealCenterY(nodeId)
        })
      }
      return
    }

    const anchorCenter =
      orderedNodeIds.reduce((sum, nodeId) => sum + getIdealCenterY(nodeId), 0) /
      orderedNodeIds.length
    const startY = anchorCenter - ((orderedNodeIds.length - 1) * WORKFLOW_LAYOUT_NODE_SPACING_Y) / 2

    orderedNodeIds.forEach((nodeId, index) => {
      const currentCenter = centerById.get(nodeId)
      if (!currentCenter) return

      centerById.set(nodeId, {
        x: currentCenter.x,
        y: startY + index * WORKFLOW_LAYOUT_NODE_SPACING_Y
      })
    })
  }

  const sortedColumnKeys = [...columnGroups.keys()].sort((left, right) => left - right)
  const reversedColumnKeys = [...sortedColumnKeys].reverse()

  for (let iteration = 0; iteration < 4; iteration += 1) {
    sortedColumnKeys.forEach((columnKey) => {
      redistributeColumn(columnGroups.get(columnKey) ?? [])
    })

    reversedColumnKeys.forEach((columnKey) => {
      redistributeColumn(columnGroups.get(columnKey) ?? [])
    })
  }

  const positions = new Map<string, WorkflowDefinitionNodePosition>()
  let minY = 0

  orderedNodes.forEach((node, index) => {
    const center = centerById.get(node.id)

    if (!center) {
      positions.set(node.id, getDefaultNodePosition(index))
      return
    }

    const y = Math.round(center.y - WORKFLOW_LAYOUT_NODE_HEIGHT / 2)
    minY = Math.min(minY, y)
    positions.set(node.id, {
      x: Math.round(center.x - WORKFLOW_LAYOUT_NODE_WIDTH / 2),
      y
    })
  })

  if (minY < 0) {
    positions.forEach((position, nodeId) => {
      positions.set(nodeId, {
        x: position.x,
        y: position.y - minY
      })
    })
  }

  return positions
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

const WorkflowEditorNodeCard = memo(function WorkflowEditorNodeCard({
  data,
  selected,
  dragging
}: NodeProps<WorkflowEditorNode>) {
  const TypeIcon = data.nodeType === 'command' ? TerminalSquare : Bot

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border px-4 py-4 bg-white',
        dragging
          ? 'border-slate-300/90 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
          : selected
            ? 'border-sky-400/85 ring-2 ring-sky-500/20 shadow-sky-500/10'
            : 'border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300/90'
      )}
      style={{
        width: WORKFLOW_NODE_WIDTH,
        minHeight: WORKFLOW_NODE_HEIGHT,
        willChange: dragging ? 'transform' : undefined
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3.5 !border-2 !border-white !bg-slate-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3.5 !border-2 !border-white !bg-slate-400"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border border-slate-200/80 bg-slate-50 text-slate-700">
            <TypeIcon className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {data.nodeType === 'agent' ? '智能体节点' : '命令节点'}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-900">{data.title}</div>
          </div>
        </div>

        <div className={EDITOR_BADGE_CLASS}>{data.indexLabel}</div>
      </div>

      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">
        {data.subtitle || '在右侧面板中配置该节点。'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3 text-[11px] text-slate-500">
        <span className={EDITOR_BADGE_CLASS}>入 {data.inboundCount}</span>
        <span className={EDITOR_BADGE_CLASS}>出 {data.outboundCount}</span>
        {data.requiresApproval && <span className={EDITOR_BADGE_CLASS}>需要审批</span>}
      </div>
    </div>
  )
})

interface EditorToolButtonProps {
  icon: typeof Save
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'outline' | 'ghost' | 'default'
  type?: 'button' | 'submit'
}

function EditorToolButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = 'outline',
  type = 'button'
}: EditorToolButtonProps) {
  return (
    <Button
      type={type}
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-9 rounded-[6px] px-3 text-xs',
        variant === 'outline' &&
          'border-slate-200/80 bg-white/88 text-slate-700 hover:bg-white hover:text-slate-900',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <Icon className="mr-1.5 size-4" />
      {label}
    </Button>
  )
}

interface EditorRailButtonProps {
  icon: typeof Save
  onClick?: () => void
  title: string
}

function EditorRailButton({ icon: Icon, onClick, title }: EditorRailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        EDITOR_RAIL_BUTTON_CLASS,
        !onClick && 'cursor-default opacity-70 hover:bg-white/88 hover:text-slate-600'
      )}
      title={title}
    >
      <Icon className="size-4" />
    </button>
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
  const outboundCountById = new Map<string, number>()

  nodes.forEach((node) => {
    node.dependsOnIds.forEach((dependencyId) => {
      outboundCountById.set(dependencyId, (outboundCountById.get(dependencyId) ?? 0) + 1)
    })
  })

  return {
    nodes: nodes.map((node, index) => ({
      id: node.id,
      type: 'workflow-editor',
      position: normalizeDraftPosition(node.position, index),
      data: {
        title: node.name.trim() || `${workflowNodeLabel} ${index + 1}`,
        subtitle:
          node.type === 'agent'
            ? node.prompt.trim() || '添加智能体提示词'
            : node.command.trim() || '添加要执行的命令',
        nodeType: node.type,
        indexLabel: `${index + 1}`,
        inboundCount: node.dependsOnIds.length,
        outboundCount: outboundCountById.get(node.id) ?? 0,
        requiresApproval: node.requiresApproval
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

const resolveWorkflowGenerationErrorMessage = (
  error: unknown,
  taskMessages: Record<string, string | undefined>
): string => {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('WORKFLOW_AI_CLI_UNAVAILABLE')) {
    return taskMessages.workflowGenerationCliUnavailable || '未检测到可用的 AI CLI 工具。'
  }

  if (message.includes('WORKFLOW_AI_GENERATION_RUNTIME_UNAVAILABLE')) {
    return (
      taskMessages.workflowGenerationRuntimeUnavailable ||
      '当前工作流生成功能暂不可用，请稍后重试。'
    )
  }

  if (
    message.includes('CLI_ONE_SHOT_TIMEOUT') ||
    message.includes('WORKFLOW_AI_GENERATION_TIMEOUT')
  ) {
    return taskMessages.workflowGenerationFailed || 'AI 生成失败，请稍后重试。'
  }

  if (message.includes('WORKFLOW_AI_GENERATION_NO_OUTPUT')) {
    return taskMessages.workflowGenerationNoOutput || 'AI 没有返回可解析的工作流结果。'
  }

  if (message.includes('WORKFLOW_AI_GENERATION_INVALID_DOCUMENT')) {
    return taskMessages.workflowGenerationInvalidResult || 'AI 返回的工作流结果无效。'
  }

  if (message.includes('WORKFLOW_AI_GENERATION_PARSE_FAILED')) {
    return taskMessages.workflowGenerationParseFailed || 'AI 返回的结果无法解析为工作流。'
  }

  if (message.includes('WORKFLOW_AI_GENERATION_FAILED')) {
    return taskMessages.workflowGenerationFailed || 'AI 生成失败，请稍后重试。'
  }

  return message
}

export function WorkflowTemplateEditor({
  active = true,
  initialValues,
  onSubmit,
  onCancel
}: WorkflowTemplateEditorProps) {
  const { t } = useLanguage()
  const initialNodeRef = useRef<TaskNodeTemplateDraft>(createDefaultNode(0))
  const formRef = useRef<HTMLFormElement | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateNodes, setTemplateNodes] = useState<TaskNodeTemplateDraft[]>([
    initialNodeRef.current
  ])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generationToolId, setGenerationToolId] = useState('')
  const [generationAgentToolConfigId, setGenerationAgentToolConfigId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])
  const [cliConfigsByTool, setCliConfigsByTool] = useState<Record<string, AgentToolConfig[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    serializeDrafts({
      name: '',
      description: undefined,
      nodes: [initialNodeRef.current]
    })
  )

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

  const generationCliTools = useMemo(() => cliTools.filter(isWorkflowGenerationCliTool), [cliTools])

  useEffect(() => {
    if (!generationToolId) return
    if (generationCliTools.some((tool) => tool.id === generationToolId)) return
    setGenerationToolId('')
    setGenerationAgentToolConfigId('')
  }, [generationCliTools, generationToolId])

  const resolveDefaultCliConfigId = useCallback(
    async (toolId: string): Promise<string> => {
      if (!toolId) return ''
      const configs = cliConfigsByTool[toolId] || (await loadCliConfigs(toolId))
      return configs.find((config) => config.is_default)?.id || ''
    },
    [cliConfigsByTool, loadCliConfigs]
  )

  useEffect(() => {
    if (!active) return
    let isMounted = true

    const loadTools = async () => {
      try {
        const detected = await window.api?.cliTools?.getSnapshot?.()
        if (isMounted) setCliTools(filterEnabledCliTools(normalizeCliTools(detected)))
        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch {
        if (isMounted) setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!isMounted) return
      setCliTools(filterEnabledCliTools(normalizeCliTools(tools)))
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
    setGenerationToolId('')
    setGenerationAgentToolConfigId('')
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
      setInitialSnapshot(
        serializeDrafts({
          name: initialValues.name,
          description: initialValues.description || undefined,
          nodes: nextNodes
        })
      )
      return
    }

    const firstNode = createDefaultNode(0)
    setTemplateName('')
    setTemplateDescription('')
    setTemplateNodes([firstNode])
    setSelectedNodeId(firstNode.id)
    setInitialSnapshot(
      serializeDrafts({
        name: '',
        description: undefined,
        nodes: [firstNode]
      })
    )
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
  const canDeleteSelection = Boolean(selectedNodeId || selectedEdgeId)
  const editorLayoutStyle = useMemo(
    () =>
      ({
        '--workflow-editor-columns': `${leftPanelCollapsed ? '72px' : '320px'} minmax(0,1fr) ${
          rightPanelCollapsed ? '72px' : '360px'
        }`
      }) as CSSProperties,
    [leftPanelCollapsed, rightPanelCollapsed]
  )

  const currentSnapshot = useMemo(
    () =>
      serializeDrafts({
        name: templateName,
        description: templateDescription || undefined,
        nodes: templateNodes
      }),
    [templateDescription, templateName, templateNodes]
  )

  const isDirty = currentSnapshot !== initialSnapshot
  const blocker = useBlocker(isDirty)

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!isDirty) return
        event.preventDefault()
        event.returnValue = ''
      },
      [isDirty]
    )
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return

    const shouldLeave = window.confirm('当前工作流还有未保存的修改，确定不保存直接离开吗？')

    if (shouldLeave) {
      blocker.proceed()
      return
    }

    blocker.reset()
  }, [blocker])

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

  const fitCanvas = useCallback(() => {
    window.requestAnimationFrame(() => {
      reactFlowInstance?.fitView({ padding: 0.18, maxZoom: 1.05, duration: 250 })
    })
  }, [reactFlowInstance])

  const applyAutoLayout = useCallback(() => {
    const nextPositions = buildAutoLayoutPositions(templateNodes)

    setTemplateNodes((prev) =>
      prev.map((node, index) => ({
        ...node,
        position: nextPositions.get(node.id) ?? normalizeDraftPosition(node.position, index)
      }))
    )
    setError(null)
    fitCanvas()
  }, [fitCanvas, templateNodes])

  const handleCancelRequest = useCallback(() => {
    if (!isDirty) {
      onCancel()
      return
    }

    const shouldLeave = window.confirm('当前工作流还有未保存的修改，确定不保存直接离开吗？')

    if (shouldLeave) {
      onCancel()
    }
  }, [isDirty, onCancel])

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceId = connection.source
      const targetId = connection.target

      if (!sourceId || !targetId) {
        return
      }

      if (sourceId === targetId) {
        setError('节点不能依赖自身。')
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
        setError('这条连线会在 DAG 中形成环。')
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

  const handleDeleteSelection = useCallback(() => {
    if (selectedEdgeId) {
      handleRemoveSelectedEdge()
      return
    }

    if (selectedNodeId && templateNodes.length > 1) {
      removeNode(selectedNodeId)
    }
  }, [handleRemoveSelectedEdge, removeNode, selectedEdgeId, selectedNodeId, templateNodes.length])

  const applyGeneratedDraft = useCallback(
    (generated: GeneratedWorkflowDefinitionResult) => {
      const draft = mapGeneratedDefinitionToDrafts(generated)
      const nextNodes = draft.nodes.length > 0 ? draft.nodes : [createDefaultNode(0)]

      setTemplateName((current) => current.trim() || draft.name)
      setTemplateDescription((current) => current.trim() || draft.description || '')
      setTemplateNodes(nextNodes)
      setSelectedNodeId(nextNodes[0]?.id ?? null)
      setSelectedEdgeId(null)
      fitCanvas()
    },
    [fitCanvas]
  )

  const handleGenerate = async () => {
    if (!generationPrompt.trim()) {
      setError(t.task.workflowGenerationPromptRequired || '请先输入工作流目标。')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const generated = await db.generateWorkflowDefinition({
        prompt: generationPrompt.trim(),
        name: templateName.trim() || undefined,
        mode: 'ai',
        toolId: generationToolId || undefined,
        agentToolConfigId: generationAgentToolConfigId || undefined
      })
      applyGeneratedDraft(generated)
    } catch (err) {
      const errorMessage = resolveWorkflowGenerationErrorMessage(err, t.task)
      const shouldFallback = window.confirm(
        `${errorMessage}\n\n${
          t.task.workflowGenerationFallbackConfirm || 'AI 生成失败，是否改用规则生成？'
        }`
      )

      if (!shouldFallback) {
        setError(errorMessage)
        return
      }

      try {
        const fallbackGenerated = await db.generateWorkflowDefinition({
          prompt: generationPrompt.trim(),
          name: templateName.trim() || undefined,
          mode: 'rules'
        })
        applyGeneratedDraft(fallbackGenerated)
      } catch (fallbackError) {
        setError(resolveWorkflowGenerationErrorMessage(fallbackError, t.task))
      }
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
      setError(t.task.workflowNodeContentRequired || '每个工作流节点都需要填写提示词或命令内容。')
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
      setInitialSnapshot(serializeDrafts(payload))
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        formRef.current?.requestSubmit()
        return
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        (selectedEdgeId || selectedNodeId)
      ) {
        event.preventDefault()
        handleDeleteSelection()
        return
      }

      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        applyAutoLayout()
        return
      }

      if (event.key === 'Escape') {
        setSelectedEdgeId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, applyAutoLayout, handleDeleteSelection, selectedEdgeId, selectedNodeId])

  return (
    <form
      ref={formRef}
      data-workflow-template-editor="true"
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {templateName.trim() ||
                (selectedNode ? selectedNode.name.trim() : '') ||
                '未命名工作流'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <div
                className={cn(
                  'rounded-[2px] border px-2.5 py-0.5 text-[11px] font-medium',
                  isDirty
                    ? 'border-amber-300/80 bg-amber-50 text-amber-700'
                    : 'border-emerald-300/80 bg-emerald-50 text-emerald-700'
                )}
              >
                {isDirty ? '未保存' : '已保存'}
              </div>
              <div className={EDITOR_BADGE_CLASS}>{templateNodes.length} 节点</div>
              <div className={EDITOR_BADGE_CLASS}>{editorGraph.edges.length} 连线</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={EDITOR_TOOLBAR_GROUP_CLASS}>
              <EditorToolButton icon={GitBranchPlus} label={t.task.addStage} onClick={addNode} />
              <EditorToolButton icon={LayoutTemplate} label="自动布局" onClick={applyAutoLayout} />
              <EditorToolButton icon={ScanSearch} label="适应画布" onClick={fitCanvas} />
              <EditorToolButton
                icon={Trash2}
                label="删除"
                variant="ghost"
                disabled={!canDeleteSelection}
                onClick={handleDeleteSelection}
              />
            </div>
            <div className={EDITOR_TOOLBAR_GROUP_CLASS}>
              <EditorToolButton
                icon={ChevronLeft}
                label={t.common.cancel}
                variant="ghost"
                onClick={handleCancelRequest}
              />
              <EditorToolButton
                icon={Save}
                label={saving ? t.task.createLoading : t.task.saveTemplate}
                type="submit"
                variant="default"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 overflow-hidden bg-slate-100 transition-[grid-template-columns] duration-200 grid-cols-1 xl:[grid-template-columns:var(--workflow-editor-columns)]"
        style={editorLayoutStyle}
      >
        <aside className="flex min-h-0 flex-col border-r border-slate-200/80 bg-slate-50">
          {leftPanelCollapsed ? (
            <div className="flex h-full flex-col items-center gap-3 px-2 py-4">
              <EditorRailButton
                icon={ChevronRight}
                onClick={() => setLeftPanelCollapsed(false)}
                title="展开工作流面板"
              />
              <div className="flex flex-col gap-2">
                <EditorRailButton icon={FileText} title="工作流信息" />
                <EditorRailButton icon={Sparkles} title="生成工作流" />
              </div>
            </div>
          ) : (
            <>
              <div className={cn(EDITOR_PANEL_HEADER_CLASS, 'bg-slate-50')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <FileText className="size-3.5" />
                      <span>工作流</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeftPanelCollapsed(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-900"
                    title="收起工作流面板"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-4 pl-0 pr-4">
                <div className="space-y-4">
                  <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                    <div className="border-b border-slate-200/70 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        模板
                      </div>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      <div>
                        <label className="text-sm font-medium">
                          {t.task.createTemplateNameLabel}
                        </label>
                        <input
                          value={templateName}
                          onChange={(event) => setTemplateName(event.target.value)}
                          placeholder={t.task.createTemplateNamePlaceholder}
                          className={EDITOR_INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          {t.task.createTemplateDescriptionLabel}
                        </label>
                        <textarea
                          value={templateDescription}
                          onChange={(event) => setTemplateDescription(event.target.value)}
                          placeholder={t.task.createTemplateDescriptionPlaceholder}
                          className={cn(EDITOR_TEXTAREA_CLASS, 'min-h-[112px]')}
                        />
                      </div>
                    </div>
                  </section>

                  <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                    <div className="border-b border-slate-200/70 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <Sparkles className="size-3.5" />
                        <span>{t.task.workflowGenerationPromptLabel || '生成'}</span>
                      </div>
                    </div>
                    <div className="px-4 py-4">
                      <textarea
                        value={generationPrompt}
                        onChange={(event) => setGenerationPrompt(event.target.value)}
                        placeholder={
                          t.task.workflowGenerationPromptPlaceholder || '描述你想生成的工作流。'
                        }
                        className={cn(EDITOR_TEXTAREA_CLASS, 'mt-0 min-h-[132px]')}
                      />
                      <div className="mt-3 grid gap-3">
                        <div>
                          <label className="text-sm font-medium">
                            {t.task.workflowGenerationCliLabel || t.task.createCliLabel}
                          </label>
                          <div className="mt-1.5">
                            <Select
                              value={generationToolId}
                              triggerClassName={EDITOR_SELECT_TRIGGER_CLASS}
                              disabled={isGenerating}
                              onValueChange={async (toolId) => {
                                setGenerationToolId(toolId)
                                if (!toolId) {
                                  setGenerationAgentToolConfigId('')
                                  return
                                }

                                const defaultConfigId = await resolveDefaultCliConfigId(toolId)
                                setGenerationAgentToolConfigId(defaultConfigId)
                              }}
                              placeholder={t.task.workflowGenerationCliAuto || '自动选择可用 CLI'}
                              options={[
                                {
                                  value: '',
                                  label: t.task.workflowGenerationCliAuto || '自动选择可用 CLI'
                                },
                                ...generationCliTools.map((tool) => ({
                                  value: tool.id,
                                  label: tool.displayName || tool.name || tool.id
                                }))
                              ]}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            {t.task.workflowGenerationCliConfigLabel || t.task.createCliConfigLabel}
                          </label>
                          <div className="mt-1.5">
                            <Select
                              value={generationAgentToolConfigId}
                              triggerClassName={EDITOR_SELECT_TRIGGER_CLASS}
                              disabled={!generationToolId || isGenerating}
                              onValueChange={(configId) => {
                                setGenerationAgentToolConfigId(configId)
                              }}
                              placeholder={
                                !generationToolId
                                  ? t.task.createCliConfigSelectTool
                                  : t.task.workflowGenerationCliConfigDefault ||
                                    '使用所选 CLI 的默认配置'
                              }
                              options={[
                                {
                                  value: '',
                                  label:
                                    t.task.workflowGenerationCliConfigDefault ||
                                    '使用所选 CLI 的默认配置'
                                },
                                ...((generationToolId
                                  ? cliConfigsByTool[generationToolId] || []
                                  : []
                                ).map((config) => ({
                                  value: config.id,
                                  label: config.name
                                })) ?? [])
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleGenerate()}
                          disabled={isGenerating}
                          className="rounded-[6px]"
                        >
                          {isGenerating
                            ? t.task.workflowGenerateLoading || '生成中...'
                            : t.task.workflowGenerateButton || '生成'}
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className={cn(EDITOR_PANEL_HEADER_CLASS, 'bg-white')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  画布
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {t.task.workflowCardTitle || '流程图'}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
                {selectedEdgeSummary ? (
                  <div className={EDITOR_BADGE_CLASS}>
                    {selectedEdgeSummary.sourceLabel} {' -> '} {selectedEdgeSummary.targetLabel}
                  </div>
                ) : selectedNode ? (
                  <>
                    <div className={EDITOR_BADGE_CLASS}>
                      {selectedNode.name.trim() ||
                        `${t.task.workflowNodeLabel} ${selectedNodeIndex + 1}`}
                    </div>
                    <div className={EDITOR_BADGE_CLASS}>
                      {selectedNode.type === 'agent' ? '智能体节点' : '命令节点'}
                    </div>
                  </>
                ) : (
                  <div className={EDITOR_BADGE_CLASS}>未选择内容</div>
                )}
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-slate-50">
            <ReactFlow
              nodes={editorGraph.nodes}
              edges={editorGraph.edges}
              nodeTypes={workflowNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
              minZoom={0.35}
              maxZoom={1.4}
              onlyRenderVisibleElements
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
              onInit={setReactFlowInstance}
              className="bg-transparent"
            >
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                className="!rounded-[2px] !border-slate-200/90 !bg-white !shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                nodeColor={(node) =>
                  node.id === selectedNodeId ? 'rgba(59,130,246,0.9)' : 'rgba(100,116,139,0.72)'
                }
              />
              <Controls
                position="top-right"
                showInteractive={false}
                className="!rounded-[2px] !shadow-none [&>button]:!rounded-[2px] [&>button]:!border-slate-200/90 [&>button]:!bg-white"
              />
            </ReactFlow>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-slate-200/80 bg-slate-50">
          {rightPanelCollapsed ? (
            <div className="flex h-full flex-col items-center gap-3 px-2 py-4">
              <EditorRailButton
                icon={ChevronLeft}
                onClick={() => setRightPanelCollapsed(false)}
                title="展开检查面板"
              />
              <div className="flex flex-col gap-2">
                <EditorRailButton icon={Settings2} title="检查面板" />
                <EditorRailButton icon={Bot} title="节点详情" />
                <EditorRailButton
                  icon={Trash2}
                  title="删除当前选择"
                  onClick={handleDeleteSelection}
                />
              </div>
            </div>
          ) : (
            <>
              <div className={cn(EDITOR_PANEL_HEADER_CLASS, 'bg-slate-50')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Settings2 className="size-3.5" />
                      <span>配置</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-900"
                    title="收起检查面板"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-4 pl-4 pr-0">
                {selectedNode ? (
                  <div className="space-y-4">
                    <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                      <div className="border-b border-slate-200/70 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t.task.workflowNodeLabel} {selectedNodeIndex + 1}
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-900">
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
                            className="rounded-[6px]"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 px-4 py-4 text-[11px] text-slate-500">
                        <span className={EDITOR_BADGE_CLASS}>
                          {selectedNode.type === 'agent' ? '智能体节点' : '命令节点'}
                        </span>
                        <span className={EDITOR_BADGE_CLASS}>
                          位置 {Math.round(selectedNode.position.x)},{' '}
                          {Math.round(selectedNode.position.y)}
                        </span>
                        {selectedNode.requiresApproval && (
                          <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                            需要审批
                          </span>
                        )}
                      </div>
                    </section>

                    <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                      <div className="border-b border-slate-200/70 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          基本
                        </div>
                      </div>
                      <div className="space-y-4 px-4 py-4">
                        <div>
                          <label className="text-sm font-medium">{'节点名称'}</label>
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
                            className={EDITOR_INPUT_CLASS}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium">{'节点类型'}</label>
                          <div className="mt-1.5">
                            <Select
                              value={selectedNode.type}
                              triggerClassName={EDITOR_SELECT_TRIGGER_CLASS}
                              onValueChange={(value) => {
                                updateNode(selectedNode.id, (current) => ({
                                  ...current,
                                  type: value as 'agent' | 'command',
                                  cliToolId: value === 'agent' ? current.cliToolId : '',
                                  agentToolConfigId:
                                    value === 'agent' ? current.agentToolConfigId : ''
                                }))
                              }}
                              options={[
                                {
                                  value: 'agent',
                                  label: t.task.workflowNodeTypeAgent || '智能体'
                                },
                                {
                                  value: 'command',
                                  label: t.task.workflowNodeTypeCommand || '命令'
                                }
                              ]}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            {selectedNode.type === 'agent'
                              ? t.task.workflowNodePromptLabel || '提示词'
                              : t.task.workflowNodeCommandLabel || '命令'}
                          </label>
                          <textarea
                            value={
                              selectedNode.type === 'agent'
                                ? selectedNode.prompt
                                : selectedNode.command
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
                                : t.task.workflowNodeCommandPlaceholder || '要执行的命令'
                            }
                            className={cn(EDITOR_TEXTAREA_CLASS, 'min-h-[136px]')}
                          />
                        </div>
                      </div>
                    </section>

                    {selectedNode.type === 'agent' && (
                      <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                        <div className="border-b border-slate-200/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            运行
                          </div>
                        </div>
                        <div className="grid gap-4 px-4 py-4">
                          <div>
                            <label className="text-sm font-medium">{t.task.createCliLabel}</label>
                            <div className="mt-1.5">
                              <Select
                                value={selectedNode.cliToolId || ''}
                                triggerClassName={EDITOR_SELECT_TRIGGER_CLASS}
                                onValueChange={async (toolId) => {
                                  let defaultConfigId = ''
                                  if (toolId) {
                                    const configs =
                                      cliConfigsByTool[toolId] || (await loadCliConfigs(toolId))
                                    const defaultConfig = configs.find(
                                      (config) => config.is_default
                                    )
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
                            <label className="text-sm font-medium">
                              {t.task.createCliConfigLabel}
                            </label>
                            <div className="mt-1.5">
                              <Select
                                value={selectedNode.agentToolConfigId || ''}
                                triggerClassName={EDITOR_SELECT_TRIGGER_CLASS}
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
                      </section>
                    )}

                    <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                      <div className="border-b border-slate-200/70 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          依赖
                        </div>
                      </div>
                      <div className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
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
                                  className="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:border-sky-300/70 hover:text-slate-900"
                                >
                                  {dependencyNode.name.trim() ||
                                    `${t.task.workflowNodeLabel} ${dependencyIndex + 1}`}
                                </button>
                              )
                            })
                          ) : (
                            <div className="text-xs text-slate-500">该节点可直接开始执行。</div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className={cn(EDITOR_SECTION_CLASS, 'overflow-hidden')}>
                      <div className="border-b border-slate-200/70 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          执行
                        </div>
                      </div>
                      <label className="flex items-center gap-3 px-4 py-4 text-sm">
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
                    </section>
                  </div>
                ) : (
                  <div
                    className={cn(
                      EDITOR_SECTION_CLASS,
                      'flex h-full items-center justify-center px-6 py-10 text-sm text-slate-500'
                    )}
                  >
                    从左侧列表或画布中选择节点进行编辑。
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/70 py-3 pl-4 pr-0">
                {selectedEdgeSummary ? (
                  <div className={cn(EDITOR_SECTION_CLASS, 'px-3 py-3')}>
                    <div className="text-xs font-medium text-slate-500">连线</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {selectedEdgeSummary.sourceLabel} {' 到 '} {selectedEdgeSummary.targetLabel}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">选择连线后可查看或删除。</div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {error && (
        <div className="border-t border-slate-200/80 bg-red-50/60 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
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
