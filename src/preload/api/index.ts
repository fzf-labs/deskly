import { cliApi } from './cli'
import { coreApi } from './core'
import { gitApi } from './git'
import { previewApi } from './preview'
import { systemApi } from './system'
import { taskApi } from './task'

export const api = {
  ...coreApi,
  ...gitApi,
  ...cliApi,
  ...previewApi,
  ...taskApi,
  ...systemApi
}

export type DesklyAPI = typeof api
