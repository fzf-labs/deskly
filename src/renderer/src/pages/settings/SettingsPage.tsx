import { useNavigate } from 'react-router-dom';

import { AppTitleBar, SidebarProvider } from '@/components/layout';
import { SettingsContent } from '@/components/settings';

function canNavigateBack() {
  if (typeof window === 'undefined') return false;

  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1;
}

export function SettingsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (canNavigateBack()) {
      navigate(-1);
      return;
    }

    navigate('/tasks', { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,#fcfdff_0%,#f5f7fb_100%)]">
        <AppTitleBar showSidebarToggle={false} />

        <div className="min-h-0 flex-1 overflow-hidden bg-background/88">
          <SettingsContent onBack={handleBack} />
        </div>
      </div>
    </SidebarProvider>
  );
}
