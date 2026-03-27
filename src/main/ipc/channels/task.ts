export const taskChannels = {
  notification: {
    show: 'notification:show',
    setEnabled: 'notification:setEnabled',
    isEnabled: 'notification:isEnabled',
    setSoundEnabled: 'notification:setSoundEnabled',
    isSoundEnabled: 'notification:isSoundEnabled',
    setSoundSettings: 'notification:setSoundSettings',
    getSoundSettings: 'notification:getSoundSettings'
  },
  database: {
    createTask: 'db:createTask',
    getTask: 'db:getTask',
    getAllTasks: 'db:getAllTasks',
    updateTask: 'db:updateTask',
    deleteTask: 'db:deleteTask',
    getTasksByProjectId: 'db:getTasksByProjectId',
    listAgentToolConfigs: 'db:listAgentToolConfigs',
    getAgentToolConfig: 'db:getAgentToolConfig',
    createAgentToolConfig: 'db:createAgentToolConfig',
    updateAgentToolConfig: 'db:updateAgentToolConfig',
    deleteAgentToolConfig: 'db:deleteAgentToolConfig',
    setDefaultAgentToolConfig: 'db:setDefaultAgentToolConfig',
    getTaskNodes: 'db:getTaskNodes',
    getTaskNode: 'db:getTaskNode',
    getCurrentTaskNode: 'db:getCurrentTaskNode',
    updateCurrentTaskNodeRuntime: 'db:updateCurrentTaskNodeRuntime',
    getTaskNodesByStatus: 'db:getTaskNodesByStatus',
    completeTaskNode: 'db:completeTaskNode',
    markTaskNodeErrorReview: 'db:markTaskNodeErrorReview',
    approveTaskNode: 'db:approveTaskNode',
    rerunTaskNode: 'db:rerunTaskNode',
    stopTaskNodeExecution: 'db:stopTaskNodeExecution'
  },
  workflow: {
    listDefinitions: 'workflow:listDefinitions',
    getDefinition: 'workflow:getDefinition',
    generateDefinition: 'workflow:generateDefinition',
    createDefinition: 'workflow:createDefinition',
    updateDefinition: 'workflow:updateDefinition',
    deleteDefinition: 'workflow:deleteDefinition',
    createRunForTask: 'workflow:createRunForTask',
    getRun: 'workflow:getRun',
    getRunByTask: 'workflow:getRunByTask',
    listRunNodes: 'workflow:listRunNodes',
    startRun: 'workflow:startRun',
    approveNode: 'workflow:approveNode',
    retryNode: 'workflow:retryNode',
    stopRun: 'workflow:stopRun'
  },
  prompt: {
    optimize: 'prompt:optimize'
  },
  task: {
    create: 'task:create',
    get: 'task:get',
    getAll: 'task:getAll',
    getByProject: 'task:getByProject',
    updateStatus: 'task:updateStatus',
    delete: 'task:delete',
    startExecution: 'task:startExecution',
    stopExecution: 'task:stopExecution'
  },
  automation: {
    create: 'automation:create',
    update: 'automation:update',
    delete: 'automation:delete',
    get: 'automation:get',
    list: 'automation:list',
    setEnabled: 'automation:setEnabled',
    runNow: 'automation:runNow',
    listRuns: 'automation:listRuns'
  }
} as const

export const taskEvents = {
  taskNode: {
    completed: 'taskNode:completed',
    review: 'taskNode:review'
  }
} as const
