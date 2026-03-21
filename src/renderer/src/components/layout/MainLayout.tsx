import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar, SidebarProvider } from '@/components/layout';

export function MainLayout() {
  const location = useLocation();
  const isProjectsRoute = location.pathname === '/projects';

  if (isProjectsRoute) {
    return (
      <div className="bg-background h-screen">
        <Outlet />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="bg-background my-3 mr-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-white/70 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
