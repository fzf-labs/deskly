import { Outlet } from 'react-router-dom'
import { AppSidebar, AppTitleBar, SidebarProvider } from '@/components/layout'

export function MainLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,#fcfdff_0%,#f5f7fb_100%)] p-3">
        <div className="surface-card flex min-h-0 flex-1 overflow-hidden rounded-[32px] border border-white/70 bg-card/96">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/88">
            <AppTitleBar />
            <div className="min-h-0 flex-1 overflow-hidden">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
