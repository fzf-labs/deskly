import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

import { cn } from '@/lib/utils'

import {
  APP_SHELL_LEFT_PANEL_WIDTH,
  clampLeftPanelWidth,
  type AppShellPanelSpec
} from './shell-config'
import { useSidebar } from './sidebar-context'

interface ShellSidebarPanelProps {
  side: 'left' | 'right'
  open: boolean
  panel?: AppShellPanelSpec
}

const DEFAULT_PANEL_WIDTH: Record<NonNullable<AppShellPanelSpec['variant']>, string> = {
  workspace: `${APP_SHELL_LEFT_PANEL_WIDTH}px`,
  settings: `${APP_SHELL_LEFT_PANEL_WIDTH}px`,
  detail: 'clamp(360px, 40vw, 920px)'
}

function resolvePanelWidth(side: 'left' | 'right', panel?: AppShellPanelSpec) {
  if (side === 'left') {
    return `${APP_SHELL_LEFT_PANEL_WIDTH}px`
  }

  if (typeof panel?.width === 'number') {
    return `${panel.width}px`
  }

  if (typeof panel?.width === 'string') {
    return panel.width
  }

  return DEFAULT_PANEL_WIDTH[panel?.variant ?? 'workspace']
}

export function ShellSidebarPanel({ side, open, panel }: ShellSidebarPanelProps) {
  const { leftPanelWidth, setLeftPanelWidth } = useSidebar()
  const isLeft = side === 'left'
  const asideRef = useRef<HTMLElement | null>(null)
  const liveWidthRef = useRef(leftPanelWidth)
  const [isResizing, setIsResizing] = useState(false)

  const width = isLeft ? `${leftPanelWidth}px` : resolvePanelWidth(side, panel)

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isLeft) return

      event.preventDefault()

      const startX = event.clientX
      const startWidth = leftPanelWidth
      liveWidthRef.current = leftPanelWidth

      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampLeftPanelWidth(startWidth + moveEvent.clientX - startX)
        liveWidthRef.current = nextWidth

        if (asideRef.current) {
          asideRef.current.style.width = `${nextWidth}px`
        }
      }

      const stopResizing = () => {
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        setIsResizing(false)
        setLeftPanelWidth(liveWidthRef.current)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopResizing)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopResizing)
    },
    [isLeft, leftPanelWidth, setLeftPanelWidth]
  )

  if (!panel?.visible || !panel.content) return null

  return (
    <aside
      ref={asideRef}
      className={cn(
        'relative flex h-full shrink-0 ease-in-out',
        isResizing
          ? 'transition-[opacity,transform,border-color]'
          : 'transition-[width,opacity,transform,border-color] duration-300',
        panel.variant === 'detail'
          ? 'border-border/70 bg-background/94 backdrop-blur-xl'
          : 'bg-sidebar/88 border-sidebar-border/75 backdrop-blur-xl',
        isLeft ? 'border-r' : 'border-l',
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none opacity-0',
        !open && 'border-transparent',
        !open && isLeft && '-translate-x-3',
        !open && !isLeft && 'translate-x-3'
      )}
      aria-hidden={!open}
      style={{ width: open ? width : 0 }}
    >
      <div className="min-w-0 flex-1 overflow-hidden">{panel.content}</div>
      {isLeft && open ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={handleResizeStart}
          className="app-no-drag group absolute inset-y-0 right-0 z-10 w-3 translate-x-1/2 cursor-col-resize touch-none"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-border group-active:bg-border" />
        </div>
      ) : null}
    </aside>
  )
}
