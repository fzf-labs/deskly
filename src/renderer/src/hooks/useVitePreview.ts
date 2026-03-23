/**
 * useVitePreview Hook
 *
 * Legacy preview hook kept for UI compatibility.
 * Renderer-to-backend HTTP preview control has been removed in favor of IPC-only flows.
 */

import { useCallback, useEffect, useState } from 'react';

export type PreviewStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'error'
  | 'stopped';

export interface PreviewState {
  previewUrl: string | null;
  status: PreviewStatus;
  error: string | null;
  hostPort: number | null;
}

export interface UseVitePreviewReturn extends PreviewState {
  startPreview: (workDir: string) => Promise<void>;
  stopPreview: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

type PreviewInstanceLike = {
  status?: PreviewStatus | 'stopping' | 'stopped';
  port?: number;
  error?: string;
};

export function useVitePreview(taskId: string | null): UseVitePreviewReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hostPort, setHostPort] = useState<number | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!taskId) return;
    if (!window.api?.preview?.getInstance) {
      setStatus('idle');
      return;
    }
    try {
      const instance = (await window.api.preview.getInstance(taskId)) as PreviewInstanceLike | null;
      if (!instance) {
        setStatus('idle');
        setPreviewUrl(null);
        setHostPort(null);
        setError(null);
        return;
      }

      const nextStatus = instance.status === 'stopped' ? 'idle' : instance.status;
      const port = typeof instance.port === 'number' ? instance.port : null;
      setStatus(nextStatus as PreviewStatus);
      setHostPort(port);
      setPreviewUrl(port ? `http://localhost:${port}` : null);
      setError(instance.error || null);
    } catch (err) {
      console.error('[useVitePreview] Error fetching status:', err);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setPreviewUrl(null);
      setStatus('idle');
      setError(null);
      setHostPort(null);
      return;
    }
    void refreshStatus();
  }, [refreshStatus, taskId]);

  const startPreview = useCallback(
    async (workDir: string) => {
      if (!taskId) {
        setError('No task ID provided');
        setStatus('error');
        return;
      }
      console.warn('[useVitePreview] Preview start is not wired to an IPC workflow yet.', {
        taskId,
        workDir,
      });
      setStatus('error');
      setError('Preview start is unavailable until this flow is migrated to IPC.');
    },
    [taskId]
  );

  const stopPreview = useCallback(async () => {
    if (!taskId) return;

    try {
      if (window.api?.preview?.stop) {
        await window.api.preview.stop(taskId);
      }
      setStatus('idle');
      setPreviewUrl(null);
      setHostPort(null);
      setError(null);
    } catch (err) {
      console.error('[useVitePreview] Stop error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [taskId]);

  return {
    previewUrl,
    status,
    error,
    hostPort,
    startPreview,
    stopPreview,
    refreshStatus,
  };
}
