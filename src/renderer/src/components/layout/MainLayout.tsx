import { Outlet } from 'react-router-dom'

import { AppControlLayer } from './app-control-layer'
import { WorkspaceSidebarContent } from './app-sidebar'
import { ShellSidebarPanel } from './ShellSidebarPanel'
import { APP_SHELL_LEFT_PANEL_WIDTH } from './shell-config'
import { resolveAppShellConfig } from './shell-config'
import { SidebarProvider, useSidebar } from './sidebar-context'

function getDefaultAppShellConfig() {
  return {
    left: {
      content: <WorkspaceSidebarContent />,
      visible: true,
      width: APP_SHELL_LEFT_PANEL_WIDTH,
      variant: 'workspace' as const
    },
    right: {
      visible: false,
      variant: 'detail' as const
    }
  }
}

function MainLayoutFrame() {
  const { leftOpen, rightOpen, shellConfig } = useSidebar()
  const resolvedShellConfig = resolveAppShellConfig(getDefaultAppShellConfig(), shellConfig)

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,#fcfdff_0%,#f5f7fb_100%)]">
      <div className="app-drag-region absolute inset-x-0 top-0 z-20 h-12" />
      <AppControlLayer />
      <ShellSidebarPanel side="left" open={leftOpen} panel={resolvedShellConfig.left} />
      <main className="min-w-0 flex-1 overflow-hidden bg-background/88">
        <Outlet />
      </main>
      <ShellSidebarPanel side="right" open={rightOpen} panel={resolvedShellConfig.right} />
    </div>
  )
}

export function MainLayout() {
  return (
    <SidebarProvider>
      <MainLayoutFrame />
    </SidebarProvider>
  )
}
