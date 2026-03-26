import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useLanguage } from './language-provider';

type ConfirmTone = 'default' | 'warning' | 'danger';
type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

export interface ToastOptions {
  title?: string;
  description: string;
  tone?: ToastTone;
  duration?: number;
}

type ToastInput = ToastOptions | string;

type ConfirmRequest = {
  id: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ToastRecord = {
  id: string;
  title: string;
  description: string;
  tone: ToastTone;
  duration: number;
};

interface ToastApi {
  show: (input: ToastInput) => string;
  success: (description: string, title?: string) => string;
  info: (description: string, title?: string) => string;
  warning: (description: string, title?: string) => string;
  error: (description: string, title?: string) => string;
  dismiss: (id: string) => void;
}

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: ToastApi;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

const DEFAULT_TOAST_DURATION_MS = 4000;

function getToastDefaultTitle(tone: ToastTone, labels: Record<ToastTone, string>): string {
  return labels[tone];
}

function getToastToneStyles(tone: ToastTone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-200/80 bg-emerald-50/95 text-emerald-900';
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/95 text-amber-900';
    case 'error':
      return 'border-red-200/80 bg-red-50/95 text-red-900';
    case 'info':
    default:
      return 'border-slate-200/80 bg-white/95 text-slate-900';
  }
}

function getToastIcon(tone: ToastTone) {
  switch (tone) {
    case 'success':
      return CheckCircle2;
    case 'warning':
      return AlertTriangle;
    case 'error':
      return XCircle;
    case 'info':
    default:
      return Info;
  }
}

function getConfirmToneIcon(tone: ConfirmTone) {
  switch (tone) {
    case 'danger':
      return XCircle;
    case 'warning':
      return AlertTriangle;
    case 'default':
    default:
      return Info;
  }
}

function getConfirmToneIconStyles(tone: ConfirmTone): string {
  switch (tone) {
    case 'danger':
      return 'bg-red-100 text-red-600';
    case 'warning':
      return 'bg-amber-100 text-amber-600';
    case 'default':
    default:
      return 'bg-sky-100 text-sky-600';
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const nextIdRef = useRef(0);
  const toastTimeoutsRef = useRef(new Map<string, number>());
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRequest[]>([]);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const activeConfirm = confirmQueue[0] ?? null;
  const toastLabels = useMemo(
    () => ({
      info: t.common.info,
      success: t.common.success,
      warning: t.common.warning,
      error: t.common.error,
    }),
    [t.common.error, t.common.info, t.common.success, t.common.warning]
  );

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current;

    return () => {
      toastTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeouts.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput): string => {
      const id = `toast-${nextIdRef.current++}`;
      const normalizedInput =
        typeof input === 'string'
          ? {
              description: input,
              tone: 'info' as const,
            }
          : input;
      const tone = normalizedInput.tone ?? 'info';
      const duration = normalizedInput.duration ?? DEFAULT_TOAST_DURATION_MS;
      const record: ToastRecord = {
        id,
        title: normalizedInput.title || getToastDefaultTitle(tone, toastLabels),
        description: normalizedInput.description,
        tone,
        duration,
      };

      setToasts((prev) => [...prev, record]);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
        toastTimeoutsRef.current.set(id, timeoutId);
      }

      return id;
    },
    [dismissToast, toastLabels]
  );

  const toast = useMemo<ToastApi>(
    () => ({
      show: (input) => showToast(input),
      success: (description, title = t.common.success) =>
        showToast({ title, description, tone: 'success' }),
      info: (description, title = t.common.info) =>
        showToast({ title, description, tone: 'info' }),
      warning: (description, title = t.common.warning) =>
        showToast({ title, description, tone: 'warning' }),
      error: (description, title = t.common.error) =>
        showToast({ title, description, tone: 'error' }),
      dismiss: dismissToast,
    }),
    [
      dismissToast,
      showToast,
      t.common.error,
      t.common.info,
      t.common.success,
      t.common.warning,
    ]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request: ConfirmRequest = {
        id: `confirm-${nextIdRef.current++}`,
        options,
        resolve,
      };
      setConfirmQueue((prev) => [...prev, request]);
    });
  }, []);

  const resolveActiveConfirm = useCallback(
    (value: boolean) => {
      if (!activeConfirm) return;
      activeConfirm.resolve(value);
      setConfirmQueue((prev) => prev.slice(1));
    },
    [activeConfirm]
  );

  const contextValue = useMemo(
    () => ({
      confirm,
      toast,
    }),
    [confirm, toast]
  );

  const activeConfirmTone = activeConfirm?.options.tone ?? 'default';
  const ConfirmIcon = getConfirmToneIcon(activeConfirmTone);

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <Dialog
        open={Boolean(activeConfirm)}
        onOpenChange={(open) => {
          if (!open) {
            resolveActiveConfirm(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {activeConfirm ? (
            <>
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full',
                      getConfirmToneIconStyles(activeConfirmTone)
                    )}
                  >
                    <ConfirmIcon className="size-5" />
                  </div>
                  <DialogTitle>
                    {activeConfirm.options.title || t.common.confirm}
                  </DialogTitle>
                </div>
                <DialogDescription className="whitespace-pre-line text-sm leading-6">
                  {activeConfirm.options.description}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => resolveActiveConfirm(false)}>
                  {activeConfirm.options.cancelText || t.common.cancel}
                </Button>
                <Button
                  variant={activeConfirmTone === 'danger' ? 'destructive' : 'default'}
                  onClick={() => resolveActiveConfirm(true)}
                >
                  {activeConfirm.options.confirmText || t.common.confirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0">
        {toasts.map((toastItem) => {
          const ToastIcon = getToastIcon(toastItem.tone);
          return (
            <div
              key={toastItem.id}
              className={cn(
                'pointer-events-auto rounded-xl border shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur',
                getToastToneStyles(toastItem.tone)
              )}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5">
                  <ToastIcon className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{toastItem.title}</div>
                  <div className="mt-1 whitespace-pre-line text-sm opacity-90">
                    {toastItem.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toastItem.id)}
                  className="rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                  aria-label={t.common.close}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }

  return context;
}

export function useConfirm() {
  return useFeedback().confirm;
}

export function useToast() {
  return useFeedback().toast;
}
