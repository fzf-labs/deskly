import { useNavigate } from 'react-router-dom';
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings';
import type { MessageAttachment } from '@/hooks/useAgent';
import { cn } from '@/lib/utils';
import { useToast } from '@/providers/feedback-provider';
import { useLanguage } from '@/providers/language-provider';
import { createTaskWithSideEffects } from '@features/tasks';
import { FileText, Globe, Palette, Smartphone } from 'lucide-react';

import { ChatInput } from '@/components/shared/ChatInput';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt?: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <FileText className="size-4" />,
    label: 'Create slides',
    prompt: '帮我创建一个演示文稿',
  },
  {
    icon: <Globe className="size-4" />,
    label: 'Build website',
    prompt: '帮我构建一个网站',
  },
  {
    icon: <Smartphone className="size-4" />,
    label: 'Develop apps',
    prompt: '帮我开发一个应用',
  },
  {
    icon: <Palette className="size-4" />,
    label: 'Design',
    prompt: '帮我设计一个界面',
  },
  { icon: null, label: 'More' },
];

export function TaskInput() {
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const isRunning = false;
  const stopAgent = () => {};

  const handleSubmit = async (
    text: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    const prompt = text.trim();

    try {
      const settings = getSettings();
      const defaultCliToolId = getEnabledDefaultCliToolId(settings);
      if (!defaultCliToolId) {
        toast.warning(
          t.settings?.cliDefaultRequired ||
            'Please enable and choose a default CLI in Settings -> Agent CLI'
        );
        return;
      }
      const createdTask = await createTaskWithSideEffects({
        title: prompt,
        prompt,
        taskMode: 'conversation',
        cliToolId: defaultCliToolId,
      });
      navigate(`/task/${createdTask.id}`, {
        state: { prompt, attachments },
      });
      return;
    } catch (error) {
      console.error('[TaskInput] Failed to initialize task:', error);
    }
  };

  const handleQuickAction = async (action: QuickAction) => {
    if (action.prompt && !isRunning) {
      await handleSubmit(action.prompt);
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      {/* Title */}
      <h1 className="text-foreground font-serif text-4xl font-medium">
        {t.home.welcomeTitle}
      </h1>

      {/* Input Box - Using shared ChatInput component */}
      <ChatInput
        variant="home"
        placeholder={t.home.inputPlaceholder}
        isRunning={isRunning}
        onSubmit={handleSubmit}
        onStop={stopAgent}
        className="w-full"
      />

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleQuickAction(action)}
            disabled={isRunning}
            className={cn(
              'border-border bg-background text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
              isRunning
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-accent hover:text-foreground'
            )}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
