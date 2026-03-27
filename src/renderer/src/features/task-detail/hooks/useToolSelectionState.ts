import { useEffect, useMemo, useState } from 'react'

import type { AgentMessage } from '@features/cli-session'

interface UseToolSelectionStateInput {
  messages: AgentMessage[]
  isRunning: boolean
  taskId?: string
}

export function useToolSelectionState({
  messages,
  isRunning,
  taskId
}: UseToolSelectionStateInput) {
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(null)
  const toolCount = useMemo(() => messages.filter((message) => message.type === 'tool_use').length, [
    messages
  ])

  useEffect(() => {
    if (isRunning && toolCount > 0) {
      setSelectedToolIndex(toolCount - 1)
    }
  }, [isRunning, toolCount])

  useEffect(() => {
    setSelectedToolIndex(null)
  }, [taskId])

  const toolSelectionValue = useMemo(
    () => ({ selectedToolIndex, setSelectedToolIndex, showComputer: () => {} }),
    [selectedToolIndex]
  )

  return {
    selectedToolIndex,
    toolSelectionValue
  }
}
