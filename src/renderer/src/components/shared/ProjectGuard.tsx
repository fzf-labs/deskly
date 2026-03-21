import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PROJECT_SETTINGS_ROUTE } from '@/components/settings';
import { useProjects } from '@/hooks/useProjects';

interface ProjectGuardProps {
  children: ReactNode;
}

export function ProjectGuard({ children }: ProjectGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, loading } = useProjects();
  const isProjectSettingsRoute =
    location.pathname === '/settings' &&
    new URLSearchParams(location.search).get('tab') === 'projects';

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0 && !isProjectSettingsRoute) {
      navigate(PROJECT_SETTINGS_ROUTE, { replace: true });
    }
  }, [isProjectSettingsRoute, loading, navigate, projects.length]);

  if (loading) {
    return null;
  }

  if (projects.length === 0 && !isProjectSettingsRoute) {
    return null;
  }

  return <>{children}</>;
}
