import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

import type { PreviewInstance } from '../../shared/contracts/preview'
import { config } from '../config'
import { safeSpawn } from '../utils/safe-exec'

const previewAllowlist = config.commandAllowlist

type PreviewInstanceRecord = PreviewInstance

export class PreviewService extends EventEmitter {
  private instances: Map<string, PreviewInstanceRecord> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private outputBuffers: Map<string, string[]> = new Map()

  async startPreview(
    instanceId: string,
    configId: string,
    command: string,
    args: string[],
    port?: number | null,
    cwd?: string,
    env?: Record<string, string>
  ): Promise<PreviewInstanceRecord> {
    await this.replaceExistingInstance(instanceId)

    const instance: PreviewInstanceRecord = {
      id: instanceId,
      configId,
      status: 'starting',
      startedAt: new Date().toISOString(),
      port: port ?? null,
      error: null
    }

    this.instances.set(instanceId, instance)
    this.outputBuffers.set(instanceId, [])

    try {
      const childProcess = safeSpawn(command, args, {
        cwd: cwd || globalThis.process.cwd(),
        env: { ...globalThis.process.env, ...env },
        allowlist: previewAllowlist,
        label: 'PreviewService'
      })

      this.processes.set(instanceId, childProcess)
      instance.pid = childProcess.pid
      instance.status = 'running'
      instance.error = null

      childProcess.stdout?.on('data', (data) => {
        this.handleOutput(instanceId, data.toString())
      })

      childProcess.stderr?.on('data', (data) => {
        this.handleOutput(instanceId, data.toString())
      })

      childProcess.on('exit', (code) => {
        this.handleExit(instanceId, code)
      })

      childProcess.on('error', (error) => {
        this.handleError(instanceId, error)
      })

      this.emit('started', instanceId)
      return { ...instance }
    } catch (error) {
      instance.status = 'error'
      instance.error = error instanceof Error ? error.message : String(error)
      this.processes.delete(instanceId)
      this.emitPreviewError(instanceId, error)
      throw error
    }
  }

  async stopPreview(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return
    }

    const process = this.processes.get(instanceId)
    if (!process) {
      instance.status = 'stopped'
      instance.error = null
      return
    }

    instance.status = 'stopping'

    if (process.exitCode !== null) {
      this.processes.delete(instanceId)
      instance.status = 'stopped'
      instance.error = null
      return
    }

    await new Promise<void>((resolve) => {
      const onExit = () => {
        resolve()
      }

      process.once('exit', onExit)
      process.kill('SIGTERM')

      setTimeout(() => {
        if (process.exitCode === null) {
          process.kill('SIGKILL')
        }
      }, 5000)
    })
  }

  restartPreview(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Preview instance ${instanceId} not found`)
    }

    void this.stopPreview(instanceId)
  }

  getInstance(instanceId: string): PreviewInstanceRecord | undefined {
    return this.instances.get(instanceId)
  }

  getAllInstances(): PreviewInstanceRecord[] {
    return Array.from(this.instances.values())
  }

  getOutput(instanceId: string, limit: number = 100): string[] {
    const buffer = this.outputBuffers.get(instanceId) || []
    return buffer.slice(-limit)
  }

  clearInstance(instanceId: string): void {
    this.instances.delete(instanceId)
    this.processes.delete(instanceId)
    this.outputBuffers.delete(instanceId)
  }

  private async replaceExistingInstance(instanceId: string): Promise<void> {
    if (!this.instances.has(instanceId)) {
      return
    }

    await this.stopPreview(instanceId)
    this.clearInstance(instanceId)
  }

  private handleOutput(instanceId: string, data: string): void {
    const buffer = this.outputBuffers.get(instanceId) || []
    const lines = data.split('\n').filter((line) => line.trim())
    buffer.push(...lines)

    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000)
    }

    this.emit('output', instanceId, lines)
  }

  private handleExit(instanceId: string, code: number | null): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.status = code === 0 ? 'stopped' : 'error'
      instance.error = code === 0 ? null : `Process exited with code ${code}`
    }

    this.processes.delete(instanceId)
    this.emit('exit', instanceId, code)
  }

  private handleError(instanceId: string, error: Error): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.status = 'error'
      instance.error = error.message
    }

    this.processes.delete(instanceId)
    this.emitPreviewError(instanceId, error)
  }

  private emitPreviewError(instanceId: string, error: unknown): void {
    if (this.listenerCount('error') > 0) {
      this.emit('error', instanceId, error)
    }
  }
}
