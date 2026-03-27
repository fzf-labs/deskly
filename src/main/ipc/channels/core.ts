export const coreChannels = {
  app: {
    getVersion: 'app:getVersion'
  },
  projects: {
    getAll: 'projects:getAll',
    get: 'projects:get',
    add: 'projects:add',
    update: 'projects:update',
    delete: 'projects:delete',
    checkPath: 'projects:checkPath'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    reset: 'settings:reset'
  }
} as const
