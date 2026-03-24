import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ListChecks,
  PlayCircle
} from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type {
  LanguageStrings,
  PipelineDisplayStatus,
  WorkflowGraph,
  WorkflowGraphNode,
  WorkflowSummary,
  WorkflowReviewNode
} from '../types'

interface WorkflowCardProps {
  t: LanguageStrings
  graph: WorkflowGraph
  summary: WorkflowSummary | null
  expanded: boolean
  currentTaskNode: WorkflowReviewNode | null
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
  onToggleExpanded: () => void
  onApproveCurrent: () => void
}

const NODE_WIDTH = 196
const NODE_HEIGHT = 74
const NODE_RADIUS = 14
const CANVAS_PADDING_X = 32
const CANVAS_PADDING_Y = 22

const getNodeTone = (status: PipelineDisplayStatus, isCurrent: boolean, selected: boolean) =>
  cn(
    'border-border/70 bg-background/98 text-foreground shadow-sm transition-all',
    status === 'done' && 'border-emerald-500/40 bg-emerald-500/8 text-emerald-700',
    status === 'in_progress' && 'border-sky-500/45 bg-sky-500/10 text-sky-700 shadow-sky-500/10',
    status === 'in_review' && 'border-amber-500/45 bg-amber-500/10 text-amber-700',
    status === 'failed' && 'border-red-500/45 bg-red-500/10 text-red-700',
    status === 'todo' && 'text-muted-foreground',
    isCurrent && 'ring-2 ring-sky-500/25',
    selected && 'ring-primary/45 ring-2'
  )

const getStatusIcon = (status: PipelineDisplayStatus) => {
  if (status === 'done') return <CheckCircle2 className="size-3.5" />
  if (status === 'in_progress') {
    return (
      <span className="size-2 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.14)]" />
    )
  }
  if (status === 'in_review') return <Clock3 className="size-3.5" />
  if (status === 'failed') return <AlertTriangle className="size-3.5" />
  return <span className="bg-muted-foreground/35 size-2 rounded-full" />
}

const getEdgeStroke = (status: PipelineDisplayStatus | undefined) => {
  if (status === 'done') return 'rgba(22, 163, 74, 0.42)'
  if (status === 'failed') return 'rgba(239, 68, 68, 0.34)'
  if (status === 'in_progress') return 'rgba(14, 165, 233, 0.38)'
  return 'rgba(148, 163, 184, 0.3)'
}

const getCompactNodeTone = (status: PipelineDisplayStatus, isCurrent: boolean, selected: boolean) =>
  cn(
    'border-border/70 bg-background text-foreground hover:border-primary/35 flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors',
    status === 'done' && 'border-emerald-500/35 bg-emerald-500/8 text-emerald-700',
    status === 'in_progress' && 'border-sky-500/40 bg-sky-500/10 text-sky-700',
    status === 'in_review' && 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    status === 'failed' && 'border-red-500/40 bg-red-500/10 text-red-700',
    status === 'todo' && 'text-muted-foreground',
    isCurrent && 'ring-2 ring-sky-500/20',
    selected && 'ring-primary/35 ring-2'
  )

const getConnectorTone = (status: PipelineDisplayStatus) => {
  if (status === 'done') return 'bg-emerald-500/35'
  if (status === 'in_progress') return 'bg-sky-500/35'
  if (status === 'in_review') return 'bg-amber-500/35'
  if (status === 'failed') return 'bg-red-500/35'
  return 'bg-border'
}

type NormalizedNode = WorkflowGraphNode & {
  left: number
  top: number
}

function buildEdgePath(source: NormalizedNode, target: NormalizedNode) {
  const startX = source.left + NODE_WIDTH
  const startY = source.top + NODE_HEIGHT / 2
  const endX = target.left
  const endY = target.top + NODE_HEIGHT / 2
  const delta = Math.max(48, Math.abs(endX - startX) * 0.45)

  return `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`
}

export function WorkflowCard({
  t,
  graph,
  summary,
  expanded,
  currentTaskNode,
  selectedNodeId,
  onSelectNode,
  onToggleExpanded,
  onApproveCurrent
}: WorkflowCardProps) {
  const layout = useMemo(() => {
    if (graph.nodes.length === 0) {
      return {
        width: 0,
        height: 0,
        nodes: [] as NormalizedNode[]
      }
    }

    const minX = Math.min(...graph.nodes.map((node) => node.position.x))
    const minY = Math.min(...graph.nodes.map((node) => node.position.y))
    const nodes = graph.nodes.map<NormalizedNode>((node) => ({
      ...node,
      left: node.position.x - minX + CANVAS_PADDING_X,
      top: node.position.y - minY + CANVAS_PADDING_Y
    }))
    const width = Math.max(...nodes.map((node) => node.left + NODE_WIDTH)) + CANVAS_PADDING_X
    const height = Math.max(...nodes.map((node) => node.top + NODE_HEIGHT)) + CANVAS_PADDING_Y

    return { width, height, nodes }
  }, [graph.nodes])

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes]
  )

  const compactNodes = useMemo(
    () => [...graph.nodes].sort((a, b) => a.node_order - b.node_order),
    [graph.nodes]
  )

  return (
    <section className="border-border/50 bg-background/95 overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border/50 flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <ListChecks className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-xs font-semibold">
            {t.task.workflowCardTitle || 'Workflow'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentTaskNode?.status === 'in_review' && (
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={onApproveCurrent}>
              <PlayCircle className="size-3.5" />
              {t.task.confirmComplete || 'Confirm complete'}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 gap-1.5 px-2.5 text-xs"
            onClick={onToggleExpanded}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded
              ? t.task.workflowCardCollapse || 'Collapse'
              : t.task.workflowCardExpand || 'Expand'}
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        {summary && summary.total > 0 ? (
          <div className="from-background via-muted/10 to-background min-w-0 rounded-2xl border border-border/60 bg-linear-to-r px-3 py-3">
            <div className="-mx-1 -my-1 flex items-center overflow-x-auto overflow-y-visible px-1 py-1.5">
              {compactNodes.map((node, index) => {
                const isSelected = selectedNodeId === node.id

                return (
                  <div key={node.id} className="flex items-center">
                    {index > 0 && (
                      <div
                        className={cn(
                          'mx-1 h-px w-6 shrink-0 sm:w-8',
                          getConnectorTone(compactNodes[index - 1]!.status)
                        )}
                      />
                    )}

                    <button
                      type="button"
                      title={node.name}
                      className={getCompactNodeTone(node.status, node.isCurrent, isSelected)}
                      onClick={() => onSelectNode?.(node.id)}
                    >
                      <div className="shrink-0">{getStatusIcon(node.status)}</div>
                      <span className="max-w-[132px] truncate text-xs font-medium">{node.name}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-muted-foreground rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm">
              {t.task.workflowCardEmpty || 'Workflow nodes will appear here once the task loads.'}
            </div>

            {currentTaskNode?.status === 'in_review' && (
              <div className="border-amber-500/30 bg-amber-50/40 flex items-center gap-2 rounded-xl border px-3 py-2">
                <PlayCircle className="size-4 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-700">
                    {t.task.taskNodeReviewTitle || 'Task node review'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{currentTaskNode.name}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {expanded && layout.nodes.length > 0 && (
          <div className="from-background via-background/96 to-muted/35 overflow-auto rounded-xl border border-border/50 bg-linear-to-br">
            <div
              className="relative min-h-[220px]"
              style={{
                width: Math.max(layout.width, 620),
                height: Math.max(layout.height, 220)
              }}
            >
              <svg
                width={Math.max(layout.width, 620)}
                height={Math.max(layout.height, 220)}
                className="pointer-events-none absolute inset-0"
              >
                <defs>
                  <marker
                    id="workflow-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                </defs>

                {graph.edges.map((edge) => {
                  const source = nodeById.get(edge.source)
                  const target = nodeById.get(edge.target)
                  if (!source || !target) return null

                  const stroke = getEdgeStroke(source.status)
                  return (
                    <g key={edge.id} style={{ color: stroke }}>
                      <path
                        d={buildEdgePath(source, target)}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={source.status === 'done' ? 1.6 : 1.3}
                        markerEnd="url(#workflow-arrow)"
                      />
                    </g>
                  )
                })}
              </svg>

              {layout.nodes.map((node) => {
                const isSelected = selectedNodeId === node.id

                return (
                  <button
                    key={node.id}
                    type="button"
                    title={node.prompt || ''}
                    className={cn(
                      'absolute rounded-xl border px-3 py-2.5 text-left',
                      'hover:border-primary/35',
                      getNodeTone(node.status, node.isCurrent, isSelected)
                    )}
                    style={{
                      left: node.left,
                      top: node.top,
                      width: NODE_WIDTH,
                      minHeight: NODE_HEIGHT,
                      borderRadius: NODE_RADIUS
                    }}
                    onClick={() => onSelectNode?.(node.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Bot className="size-3.5" />
                          <span className="truncate text-[13px] font-semibold">{node.name}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-[10px] leading-4">
                          {node.prompt || ' '}
                        </p>
                      </div>
                      <div className="pt-0.5">{getStatusIcon(node.status)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
