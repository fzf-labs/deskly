import { Outlet } from 'react-router-dom'
import { AppSidebar, AppTitleBar, SidebarProvider } from '@/components/layout'

export function MainLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,#fcfdff_0%,#f5f7fb_100%)]">
        <AppTitleBar />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="surface-card flex min-h-0 flex-1 overflow-hidden border border-white/70 bg-card/96">
            <AppSidebar />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background/88">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
