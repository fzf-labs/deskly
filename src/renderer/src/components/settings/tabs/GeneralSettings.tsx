import type { Language } from '@/config/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import { useTheme } from '@/providers/theme-provider';

import type { SettingsTabProps } from '../types';

const THEME_OPTIONS = [
  { id: 'light', labelKey: 'light' },
  { id: 'dark', labelKey: 'dark' },
  { id: 'system', labelKey: 'system' },
] as const;

function ThemePreview({ theme }: { theme: (typeof THEME_OPTIONS)[number]['id'] }) {
  if (theme === 'light') {
    return (
      <div className="flex h-20 w-28 items-center justify-center rounded-lg bg-white transition-all">
        <div className="flex h-12 w-20 flex-col gap-1 rounded border border-gray-200 bg-gray-100 p-1.5">
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-sm bg-gray-300" />
            <div className="h-3 flex-1 rounded-sm bg-gray-200" />
          </div>
          <div className="flex-1 rounded-sm border border-gray-200 bg-white" />
        </div>
      </div>
    );
  }

  if (theme === 'dark') {
    return (
      <div className="flex h-20 w-28 items-center justify-center rounded-lg bg-gray-900 transition-all">
        <div className="flex h-12 w-20 flex-col gap-1 rounded border border-gray-700 bg-gray-800 p-1.5">
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-sm bg-gray-600" />
            <div className="h-3 flex-1 rounded-sm bg-gray-700" />
          </div>
          <div className="flex-1 rounded-sm border border-gray-700 bg-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg transition-all">
      <div className="flex h-full w-full">
        <div className="flex h-full w-1/2 items-center justify-center bg-white">
          <div className="flex h-12 w-10 flex-col gap-0.5 rounded-l border-y border-l border-gray-200 bg-gray-100 p-1">
            <div className="h-2 w-2 rounded-sm bg-gray-300" />
            <div className="flex-1 rounded-sm border border-gray-200 bg-white" />
          </div>
        </div>
        <div className="flex h-full w-1/2 items-center justify-center bg-gray-900">
          <div className="flex h-12 w-10 flex-col gap-0.5 rounded-r border-y border-r border-gray-700 bg-gray-800 p-1">
            <div className="h-2 w-2 rounded-sm bg-gray-600" />
            <div className="flex-1 rounded-sm border border-gray-700 bg-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GeneralSettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    onSettingsChange({ ...settings, theme: newTheme });
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    onSettingsChange({ ...settings, language: newLang });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings.language}
        </label>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as Language)}
          className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full max-w-xs cursor-pointer rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
        >
          <option value="en-US">English</option>
          <option value="zh-CN">简体中文</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-foreground block text-sm font-medium">
          {t.settings.appearance}
        </label>
        <div className="flex flex-wrap gap-3">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleThemeChange(option.id)}
              className={cn(
                'group flex cursor-pointer flex-col items-center gap-2 rounded-xl focus-visible:ring-2 focus-visible:outline-none',
                theme === option.id
                  ? 'focus-visible:ring-primary/30'
                  : 'focus-visible:ring-ring'
              )}
            >
              <div
                className={cn(
                  'rounded-lg border-2 transition-all',
                  theme === option.id
                    ? 'border-primary ring-primary/20 ring-2'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <ThemePreview theme={option.id} />
              </div>
              <span
                className={cn(
                  'text-sm',
                  theme === option.id
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                )}
              >
                {t.settings[option.labelKey]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
