import { app, shell, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconMac from '../../resources/icon-mac.png?asset'
import { assertUrlAllowed } from './utils/url-guard'
import { addAllowedRoot } from './utils/fs-allowlist'
import { registerIpcHandlers } from './ipc'
import { IPC_EVENTS } from './ipc/channels'
import { AppContext } from './app/AppContext'
import { createAppContext } from './app/create-app-context'

let appContext: AppContext | null = null

const APP_NAME = 'Deskly'
const APP_IDENTIFIER = 'com.fzf-labs.deskly'
const STARTUP_WINDOW_REVEAL_TIMEOUT_MS = 5000

let mainWindow: BrowserWindow | null = null
const resolveProjectIdForSession = (sessionId: string): string | null =>
  appContext?.resolveProjectIdForSession(sessionId) ?? null

function revealMainWindow(reason: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  console.info('[main-window] Revealing main window', {
    reason,
    visible: mainWindow.isVisible(),
    focused: mainWindow.isFocused()
  })

  if (!mainWindow.isVisible()) {
    mainWindow.maximize()
    mainWindow.show()
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
}

function createWindow(): BrowserWindow {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 900,
    height: 670,
    title: '',
    fullscreen: false,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'
  }

  mainWindow = new BrowserWindow(windowOptions)
  const createdWindow = mainWindow
  const startupRevealTimer = setTimeout(() => {
    if (mainWindow === createdWindow) {
      revealMainWindow('startup-timeout')
    }
  }, STARTUP_WINDOW_REVEAL_TIMEOUT_MS)
  const clearStartupRevealTimer = (): void => clearTimeout(startupRevealTimer)

  createdWindow.on('closed', () => {
    clearStartupRevealTimer()
    if (mainWindow === createdWindow) {
      mainWindow = null
    }
  })

  createdWindow.on('ready-to-show', () => {
    clearStartupRevealTimer()
    revealMainWindow('ready-to-show')
  })

  createdWindow.on('show', () => {
    console.info('[main-window] Show event fired')
  })

  createdWindow.webContents.on('did-finish-load', () => {
    clearStartupRevealTimer()
    revealMainWindow('did-finish-load')
  })

  createdWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('[main-window] Failed to load content', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })

      if (!isMainFrame) {
        return
      }

      clearStartupRevealTimer()
      revealMainWindow('did-fail-load')
    }
  )

  createdWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main-window] Renderer process gone', details)
  })

  createdWindow.webContents.setWindowOpenHandler((details) => {
    try {
      assertUrlAllowed(details.url, 'window:open')
      shell.openExternal(details.url)
    } catch (error) {
      console.error('Blocked window open:', error)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void createdWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch((error) => {
      console.error('[main-window] Failed to load renderer URL', error)
      clearStartupRevealTimer()
      revealMainWindow('load-url-error')
    })
  } else {
    void createdWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((error) => {
      console.error('[main-window] Failed to load renderer file', error)
      clearStartupRevealTimer()
      revealMainWindow('load-file-error')
    })
  }

  return createdWindow
}

const acquiredSingleInstanceLock = app.requestSingleInstanceLock()

if (!acquiredSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    revealMainWindow('second-instance')
  })

  app.whenReady().then(async () => {
    app.setName(APP_NAME)
    electronApp.setAppUserModelId(APP_IDENTIFIER)
    console.info('[NotifyDebug][main] App identity', {
      name: app.getName(),
      execPath: process.execPath
    })

    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(iconMac)
    }

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    appContext = createAppContext()
    await appContext.init()

    const { services, appPaths } = appContext
    const { cliSessionService, taskNodeRuntimeService, terminalService } = services

    try {
      await addAllowedRoot(process.resourcesPath)
    } catch (error) {
      console.warn('[fs-allowlist] Failed to add resources root:', error)
    }
    try {
      await addAllowedRoot(app.getAppPath())
    } catch (error) {
      console.warn('[fs-allowlist] Failed to add app root:', error)
    }

    appContext.trackDisposable(
      taskNodeRuntimeService.onTaskNodeStatusChange((node) => {
        if (!mainWindow || mainWindow.isDestroyed()) return

        const payload = {
          id: node.id,
          name: node.name || '',
          taskId: node.task_id
        }
        console.info('[NotifyDebug][main] Task node status changed', {
          nodeId: node.id,
          taskId: node.task_id,
          status: node.status,
          name: node.name || ''
        })

        if (node.status === 'in_review') {
          console.info('[NotifyDebug][main] Emitting taskNode.review event', payload)
          mainWindow.webContents.send(IPC_EVENTS.taskNode.review, payload)
          return
        }

        if (node.status === 'done') {
          console.info('[NotifyDebug][main] Emitting taskNode.completed event', payload)
          mainWindow.webContents.send(IPC_EVENTS.taskNode.completed, payload)
          return
        }
      })
    )

    appContext.trackEvent(cliSessionService, 'output', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.cliSession.output, data)
      }
    })

    appContext.trackEvent(cliSessionService, 'status', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.cliSession.status, data)
      }
    })

    appContext.trackEvent(cliSessionService, 'close', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.cliSession.close, data)
      }
    })

    appContext.trackEvent(cliSessionService, 'error', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.cliSession.error, data)
      }
    })

    appContext.trackEvent(terminalService, 'data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.terminal.data, data)
      }
    })

    appContext.trackEvent(terminalService, 'exit', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.terminal.exit, data)
      }
    })

    appContext.trackEvent(terminalService, 'error', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.terminal.error, data)
      }
    })

    registerIpcHandlers({
      services,
      appPaths,
      resolveProjectIdForSession
    })

    createWindow()

    app.on('activate', function () {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow()
        return
      }

      revealMainWindow('activate')
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (appContext) {
    void appContext.dispose()
  }
})
