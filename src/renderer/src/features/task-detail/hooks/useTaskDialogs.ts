import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'

import { db, type Task } from '@/data'
import { isCliToolEnabled } from '@/lib/agent-cli-tool-enablement'
import { deleteTaskWithSideEffects, updateTaskWithSideEffects } from '@features/tasks'

import type { CurrentNodeRuntime } from '../types'

interface UseTaskDialogsInput {
  taskId?: string
  task: Task | null
  currentNodeRuntime: CurrentNodeRuntime
  navigate: NavigateFunction
  setTask: Dispatch<SetStateAction<Task | null>>
  loadCurrentNodeRuntime: () => Promise<CurrentNodeRuntime>
}

export function useTaskDialogs({
  taskId,
  task,
  currentNodeRuntime,
  navigate,
  setTask,
  loadCurrentNodeRuntime
}: UseTaskDialogsInput) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [editCliToolId, setEditCliToolId] = useState('')
  const [editCliConfigId, setEditCliConfigId] = useState('')
  const [cliConfigs, setCliConfigs] = useState<Array<{ id: string; name: string; is_default?: number }>>(
    []
  )

  useEffect(() => {
    if (!isEditOpen) {
      return
    }

    if (!editCliToolId || isCliToolEnabled(editCliToolId)) {
      return
    }

    setEditCliToolId('')
    setEditCliConfigId('')
  }, [editCliToolId, isEditOpen])

  const handleOpenEdit = useCallback(() => {
    if (!task || task.status !== 'todo') {
      return
    }

    setEditPrompt(task.prompt || '')
    setEditCliToolId(
      isCliToolEnabled(currentNodeRuntime.cliToolId) ? currentNodeRuntime.cliToolId || '' : ''
    )
    setEditCliConfigId(currentNodeRuntime.agentToolConfigId || '')
    setIsEditOpen(true)
  }, [currentNodeRuntime.agentToolConfigId, currentNodeRuntime.cliToolId, task])

  const handleSaveEdit = useCallback(async () => {
    if (!taskId) {
      return
    }

    const trimmedPrompt = editPrompt.trim()
    if (!trimmedPrompt) {
      return
    }

    try {
      const updatedTask = await updateTaskWithSideEffects(taskId, {
        prompt: trimmedPrompt
      })
      await db.updateCurrentTaskNodeRuntime(taskId, {
        cli_tool_id: editCliToolId || null,
        agent_tool_config_id: editCliConfigId || null
      })
      await loadCurrentNodeRuntime()
      if (updatedTask) {
        setTask(updatedTask)
      }
      setIsEditOpen(false)
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }, [editCliConfigId, editCliToolId, editPrompt, loadCurrentNodeRuntime, setTask, taskId])

  const handleDeleteTask = useCallback(async () => {
    if (!taskId) {
      return
    }

    try {
      await deleteTaskWithSideEffects(taskId)
      setIsDeleteOpen(false)
      navigate('/board', { replace: true })
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [navigate, taskId])

  useEffect(() => {
    if (!isEditOpen) {
      return
    }

    if (!editCliToolId) {
      setCliConfigs([])
      setEditCliConfigId('')
      return
    }

    let active = true
    const loadConfigs = async () => {
      try {
        const result = await db.listAgentToolConfigs(editCliToolId)
        const list = Array.isArray(result)
          ? (result as Array<{ id: string; name: string; is_default?: number }>)
          : []

        if (!active) {
          return
        }

        setCliConfigs(list)
        const exists = editCliConfigId && list.some((config) => config.id === editCliConfigId)
        if (!exists) {
          const defaultConfig = list.find((config) => config.is_default)
          setEditCliConfigId(defaultConfig?.id || '')
        }
      } catch {
        if (active) {
          setCliConfigs([])
          setEditCliConfigId('')
        }
      }
    }

    void loadConfigs()

    return () => {
      active = false
    }
  }, [editCliConfigId, editCliToolId, isEditOpen])

  return {
    isEditOpen,
    setIsEditOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    editPrompt,
    setEditPrompt,
    editCliToolId,
    setEditCliToolId,
    editCliConfigId,
    setEditCliConfigId,
    cliConfigs,
    handleOpenEdit,
    handleSaveEdit,
    handleDeleteTask
  }
}
