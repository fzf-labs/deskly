export const previewChannels = {
  editor: {
    getAvailable: 'editor:getAvailable',
    openProject: 'editor:openProject'
  },
  previewConfig: {
    getAll: 'previewConfig:getAll',
    getByProject: 'previewConfig:getByProject',
    get: 'previewConfig:get',
    add: 'previewConfig:add',
    update: 'previewConfig:update',
    delete: 'previewConfig:delete'
  },
  preview: {
    start: 'preview:start',
    stop: 'preview:stop',
    getInstance: 'preview:getInstance',
    getAllInstances: 'preview:getAllInstances',
    getOutput: 'preview:getOutput',
    clearInstance: 'preview:clearInstance'
  }
} as const
