// Error handling utilities for agent

import { getErrorMessages } from './config';

// Helper to format fetch errors with more details (user-friendly, localized)
export function formatFetchError(error: unknown, _endpoint: string): string {
  const err = error as Error;
  const message = err.message || String(error);
  const t = getErrorMessages();

  // Common error patterns - use friendly messages
  if (
    message === 'Load failed' ||
    message === 'Failed to fetch' ||
    message.includes('NetworkError')
  ) {
    return t.connectionFailedFinal;
  }

  if (message.includes('CORS') || message.includes('cross-origin')) {
    return t.corsError;
  }

  if (message.includes('timeout') || message.includes('Timeout')) {
    return t.timeout;
  }

  if (message.includes('ECONNREFUSED')) {
    return t.serverNotRunning;
  }

  // Return generic message for other errors
  return t.requestFailed.replace('{message}', message);
}
