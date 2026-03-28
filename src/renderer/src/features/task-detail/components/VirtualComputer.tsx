import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Code,
  FileText,
  Globe,
  Monitor,
  Search,
  Terminal
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AgentMessage } from '@features/cli-session'

interface VirtualComputerProps {
  messages: AgentMessage[]
  isRunning: boolean
  selectedStepIndex?: number | null
  onStepSelect?: (index: number) => void
}

interface StepOutput {
  index: number
  toolName: string
  description: string
  content: string
}

const toolIconMap = {
  Bash: Terminal,
  Read: FileText,
  Write: FileText,
  Edit: Code,
  Grep: Search,
  Glob: Search,
  WebFetch: Globe,
  WebSearch: Globe
} satisfies Record<string, typeof Monitor>

function extractStepOutputs(messages: AgentMessage[]): StepOutput[] {
  const toolResults = messages.filter((message) => message.type === 'tool_result')

  return messages
    .filter((message): message is AgentMessage & { type: 'tool_use'; name: string } =>
      message.type === 'tool_use' && Boolean(message.name)
    )
    .map((message, index) => {
      const result = toolResults[index]
      const input = message.input as Record<string, unknown> | undefined
      const toolName = message.name
      const contentSource = result?.output || result?.content || ''
      const content =
        typeof contentSource === 'string'
          ? contentSource
          : JSON.stringify(contentSource ?? input ?? {}, null, 2)

      return {
        index,
        toolName,
        description: getToolActionText(toolName, input),
        content
      }
    })
}

function getToolActionText(toolName: string, input?: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return `Running ${(input?.command as string) || 'command'}`
    case 'Read':
    case 'Write':
    case 'Edit':
      return `Touching ${(input?.file_path as string) || 'file'}`
    case 'Grep':
    case 'Glob':
      return `Searching ${(input?.pattern as string) || 'workspace'}`
    case 'WebFetch':
      return `Fetching ${(input?.url as string) || 'page'}`
    case 'WebSearch':
      return `Searching ${(input?.query as string) || 'web'}`
    default:
      return `Using ${toolName}`
  }
}

export function VirtualComputer({
  messages,
  isRunning,
  selectedStepIndex,
  onStepSelect
}: VirtualComputerProps) {
  const steps = useMemo(() => extractStepOutputs(messages), [messages])
  const [internalStep, setInternalStep] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)

  const currentStep =
    selectedStepIndex !== null && selectedStepIndex !== undefined
      ? selectedStepIndex
      : internalStep

  useEffect(() => {
    if (steps.length === 0) {
      setInternalStep(0)
      return
    }
    if (selectedStepIndex === null || selectedStepIndex === undefined) {
      setInternalStep(steps.length - 1)
    }
  }, [selectedStepIndex, steps.length])

  const setCurrentStep = (index: number) => {
    if (onStepSelect) {
      onStepSelect(index)
      return
    }
    setInternalStep(index)
  }

  const activeStep = steps[currentStep] || null
  const ActiveIcon = activeStep ? toolIconMap[activeStep.toolName] || Monitor : Monitor

  return (
    <div className="border-border/60 bg-background flex h-full min-h-0 overflow-hidden rounded-xl border">
      <div className="border-border/60 bg-muted/20 flex w-72 shrink-0 flex-col border-r">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-foreground hover:bg-accent/60 flex items-center justify-between border-b px-4 py-3 text-sm font-medium"
        >
          <span>Execution Timeline</span>
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {isExpanded ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {steps.length === 0 ? (
              <div className="text-muted-foreground p-3 text-xs">
                {isRunning ? 'Waiting for tool activity...' : 'No tool activity yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => {
                  const StepIcon = toolIconMap[step.toolName] || Monitor
                  const isActive = index === currentStep
                  return (
                    <button
                      key={`${step.toolName}-${step.index}`}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60 text-muted-foreground'
                      )}
                    >
                      <StepIcon className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{step.toolName}</div>
                        <div className="truncate text-xs">{step.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-border/60 bg-muted/10 flex items-center gap-3 border-b px-4 py-3">
          <div className="bg-background flex size-8 items-center justify-center rounded-lg border">
            <ActiveIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-sm font-medium">
              {activeStep?.toolName || 'Deskly Computer'}
            </div>
            <div className="text-muted-foreground truncate text-xs">
              {activeStep?.description ||
                (isRunning ? 'Agent is preparing the next step.' : 'Execution details will appear here.')}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {activeStep ? (
            <pre className="bg-muted/30 text-foreground min-h-full whitespace-pre-wrap rounded-lg p-4 text-xs leading-5">
              {activeStep.content || 'No output'}
            </pre>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              {isRunning ? 'Waiting for tool output...' : 'No steps recorded.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
