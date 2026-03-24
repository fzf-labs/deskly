import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

export interface TerminalInstance {
  xterm: Terminal
  fitAddon: FitAddon
}

export function createTerminalInstance(
  container: HTMLDivElement,
  options?: { onUrlClick?: (url: string) => void }
): TerminalInstance {
  const xterm = new Terminal({
    fontFamily: 'Menlo, Monaco, "SF Mono", "Liberation Mono", monospace',
    fontSize: 12,
    lineHeight: 1.3,
    cursorBlink: true,
    theme: {
      background: '#0b0b0d',
      foreground: '#f5f5f5'
    }
  })

  xterm.open(container)

  const fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)

  if (options?.onUrlClick) {
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (event.metaKey || event.ctrlKey) {
        options.onUrlClick?.(uri)
      }
    })
    xterm.loadAddon(webLinksAddon)
  }

  return {
    xterm,
    fitAddon
  }
}
