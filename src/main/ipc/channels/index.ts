import { cliChannels, cliEvents } from './cli'
import { IpcContract, IpcContractChannel, IpcContracts, IpcArgs, IpcResult, OutputSnapshot } from './contracts'
import { coreChannels } from './core'
import { gitChannels } from './git'
import { previewChannels } from './preview'
import { systemChannels } from './system'
import { taskChannels, taskEvents } from './task'

type ValueOf<T> = T[keyof T]
type NestedValueOf<T> = ValueOf<ValueOf<T>>

export const IPC_CHANNELS = {
  ...coreChannels,
  ...gitChannels,
  ...cliChannels,
  ...previewChannels,
  ...taskChannels,
  ...systemChannels
} as const

export const IPC_EVENTS = {
  ...cliEvents,
  ...taskEvents
} as const

export type IpcChannel = NestedValueOf<typeof IPC_CHANNELS>
export type IpcEvent = NestedValueOf<typeof IPC_EVENTS>

export type {
  IpcContract,
  IpcContractChannel,
  IpcContracts,
  IpcArgs,
  IpcResult,
  OutputSnapshot
}
