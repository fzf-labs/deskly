import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import {
  APP_SHELL_LEFT_PANEL_WIDTH,
  clampLeftPanelWidth,
  type AppShellConfig
} from './shell-config';

const LEFT_PANEL_WIDTH_STORAGE_KEY = 'deskly_left_panel_width'

function getInitialLeftPanelWidth() {
  if (typeof window === 'undefined') return APP_SHELL_LEFT_PANEL_WIDTH

  const storedValue = window.localStorage.getItem(LEFT_PANEL_WIDTH_STORAGE_KEY)
  const parsedValue = Number(storedValue)
  return Number.isFinite(parsedValue)
    ? clampLeftPanelWidth(parsedValue)
    : APP_SHELL_LEFT_PANEL_WIDTH
}

interface SidebarContextType {
  leftOpen: boolean;
  rightOpen: boolean;
  leftPanelWidth: number;
  shellConfig: AppShellConfig;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setShellConfig: (config: AppShellConfig) => void;
  resetShellConfig: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidthState] = useState(getInitialLeftPanelWidth);
  const [shellConfig, setShellConfigState] = useState<AppShellConfig>({});

  const toggleLeft = useCallback(() => setLeftOpen((prev) => !prev), []);
  const toggleRight = useCallback(() => setRightOpen((prev) => !prev), []);
  const setLeftPanelWidth = useCallback((width: number) => {
    const nextWidth = clampLeftPanelWidth(width)
    setLeftPanelWidthState(nextWidth)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LEFT_PANEL_WIDTH_STORAGE_KEY, String(nextWidth))
    }
  }, []);
  const setShellConfig = useCallback((config: AppShellConfig) => {
    setShellConfigState(config);
  }, []);
  const resetShellConfig = useCallback(() => {
    setShellConfigState({});
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        leftOpen,
        rightOpen,
        leftPanelWidth,
        shellConfig,
        toggleLeft,
        toggleRight,
        setLeftOpen,
        setRightOpen,
        setLeftPanelWidth,
        setShellConfig,
        resetShellConfig,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
