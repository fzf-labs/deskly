import { Outlet } from 'react-router-dom'

import { AppControlLayer } from './app-control-layer'
import { AppSidebar } from './app-sidebar'
import { SidebarProvider } from './sidebar-context'

function MainLayoutFrame() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,#fcfdff_0%,#f5f7fb_100%)]">
      <div className="app-drag-region absolute inset-x-0 top-0 z-20 h-12" />
      <AppControlLayer />
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-hidden bg-background/88">
        <Outlet />
      </main>
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
