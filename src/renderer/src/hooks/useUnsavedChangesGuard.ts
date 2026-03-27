import { useCallback, useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  confirmLeave: () => Promise<boolean>;
}

export function useUnsavedChangesGuard({
  isDirty,
  confirmLeave,
}: UseUnsavedChangesGuardOptions) {
  const blocker = useBlocker(isDirty);
  const isPromptingRef = useRef(false);
  const allowNextNavigationRef = useRef(false);
  const previousDirtyRef = useRef(isDirty);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!isDirty) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [isDirty]
    )
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      blocker.proceed();
      return;
    }

    if (isPromptingRef.current) return;

    let cancelled = false;
    isPromptingRef.current = true;

    void (async () => {
      const shouldLeave = await confirmLeave();
      if (cancelled) return;

      isPromptingRef.current = false;
      if (shouldLeave) {
        blocker.proceed();
        return;
      }

      blocker.reset();
    })();

    return () => {
      cancelled = true;
      isPromptingRef.current = false;
    };
  }, [blocker, confirmLeave]);

  useEffect(() => {
    if (isDirty && !previousDirtyRef.current) {
      allowNextNavigationRef.current = false;
    }
    previousDirtyRef.current = isDirty;
  }, [isDirty]);

  const confirmIfDirty = useCallback(async () => {
    if (!isDirty) return true;
    if (isPromptingRef.current) return false;

    isPromptingRef.current = true;
    try {
      return await confirmLeave();
    } finally {
      isPromptingRef.current = false;
    }
  }, [confirmLeave, isDirty]);

  const confirmNavigationIfDirty = useCallback(async () => {
    const confirmed = await confirmIfDirty();
    if (confirmed) {
      allowNextNavigationRef.current = true;
    }
    return confirmed;
  }, [confirmIfDirty]);

  const allowNextNavigation = useCallback(() => {
    allowNextNavigationRef.current = true;
  }, []);

  const resetNavigationAllowance = useCallback(() => {
    allowNextNavigationRef.current = false;
  }, []);

  return {
    allowNextNavigation,
    confirmIfDirty,
    confirmNavigationIfDirty,
    resetNavigationAllowance,
  };
}
