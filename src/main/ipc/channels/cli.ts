export const cliChannels = {
  cli: {
    startSession: 'cli:startSession',
    stopSession: 'cli:stopSession',
    getOutput: 'cli:getOutput'
  },
  terminal: {
    startSession: 'terminal:startSession',
    write: 'terminal:write',
    resize: 'terminal:resize',
    signal: 'terminal:signal',
    kill: 'terminal:kill',
    detach: 'terminal:detach',
    killByWorkspaceId: 'terminal:killByWorkspaceId'
  },
  cliSession: {
    startSession: 'cliSession:startSession',
    stopSession: 'cliSession:stopSession',
    sendInput: 'cliSession:sendInput',
    getSessions: 'cliSession:getSessions',
    getSession: 'cliSession:getSession'
  },
  logStream: {
    subscribe: 'logStream:subscribe',
    unsubscribe: 'logStream:unsubscribe',
    getHistory: 'logStream:getHistory'
  },
  cliTools: {
    getAll: 'cliTools:getAll',
    getSnapshot: 'cliTools:getSnapshot',
    refresh: 'cliTools:refresh',
    detect: 'cliTools:detect',
    detectAll: 'cliTools:detectAll'
  },
  cliToolConfig: {
    get: 'cliToolConfig:get',
    save: 'cliToolConfig:save'
  },
  systemCliTools: {
    getAll: 'systemCliTools:getAll',
    getSnapshot: 'systemCliTools:getSnapshot',
    refresh: 'systemCliTools:refresh',
    detect: 'systemCliTools:detect',
    detectAll: 'systemCliTools:detectAll'
  }
} as const

export const cliEvents = {
  cliSession: {
    status: 'cliSession:status',
    output: 'cliSession:output',
    close: 'cliSession:close',
    error: 'cliSession:error'
  },
  terminal: {
    data: 'terminal:data',
    exit: 'terminal:exit',
    error: 'terminal:error'
  },
  logStream: {
    message: 'logStream:message'
  },
  cliTools: {
    updated: 'cliTools:updated'
  },
  systemCliTools: {
    updated: 'systemCliTools:updated'
  }
} as const
