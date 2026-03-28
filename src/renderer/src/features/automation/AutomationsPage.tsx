import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyStatePanel, PageBody, PageFrame, PageHeader } from '@/components/shared/page-shell'
import { db, type AgentToolConfig } from '@/data'
import { useProjects } from '@features/projects'
import { useConfirm } from '@/providers/feedback-provider'
import { useLanguage } from '@/providers/language-provider'
import type { CreateAutomationRequest } from '@shared/contracts/automation'
import type { Automation, AutomationRun } from '@/types/automation'
import { AutomationFormDialog } from './ui/AutomationFormDialog'
import { AutomationList } from './ui/AutomationList'

export function AutomationsPage() {
  const { t, tt } = useLanguage()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { currentProject } = useProjects()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runsByAutomationId, setRunsByAutomationId] = useState<Record<string, AutomationRun[]>>({})
  const [runsLoadingByAutomationId, setRunsLoadingByAutomationId] = useState<
    Record<string, boolean>
  >({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([])

  const loadAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const [list, configs] = await Promise.all([
        db.listAutomations(),
        db.listAgentToolConfigs() as Promise<AgentToolConfig[]>
      ])

      const filteredByProject = currentProject?.id
        ? list.filter((automation) => automation.template_json.projectId === currentProject.id)
        : list

      setAutomations(filteredByProject)
      setCliConfigs(configs)

      const runsMap: Record<string, AutomationRun[]> = {}
      for (const automation of filteredByProject) {
        runsMap[automation.id] = await db.listAutomationRuns(automation.id, 20)
      }
      setRunsByAutomationId(runsMap)
    } catch (error) {
      console.error('[AutomationsPage] Failed to load automations:', error)
    } finally {
      setLoading(false)
    }
  }, [currentProject?.id])

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  const filteredAutomations = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) return automations

    return automations.filter((automation) => {
      const target = [
        automation.name,
        automation.template_json.title,
        automation.template_json.prompt,
        automation.template_json.projectPath
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return target.includes(keyword)
    })
  }, [automations, searchKeyword])

  const refreshAutomationRuns = useCallback(async (automationId: string) => {
    setRunsLoadingByAutomationId((prev) => ({ ...prev, [automationId]: true }))

    try {
      const runs = await db.listAutomationRuns(automationId, 20)
      setRunsByAutomationId((prev) => ({ ...prev, [automationId]: runs }))
    } catch (error) {
      console.error('[AutomationsPage] Failed to refresh automation runs:', error)
    } finally {
      setRunsLoadingByAutomationId((prev) => ({ ...prev, [automationId]: false }))
    }
  }, [])

  const handleCreate = () => {
    if (!currentProject?.id) return
    setEditingAutomation(null)
    setDialogOpen(true)
  }

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation)
    setDialogOpen(true)
  }

  const handleDelete = useCallback(
    async (automation: Automation) => {
      const confirmed = await confirm({
        title: t.common.deleteAutomation || '删除规则',
        description:
          tt('common.deleteAutomationConfirm', { name: automation.name }) ||
          `确认删除规则「${automation.name}」吗？`,
        confirmText: t.common.delete,
        cancelText: t.common.cancel,
        tone: 'danger'
      })
      if (!confirmed) return

      await db.deleteAutomation(automation.id)
      await loadAutomations()
    },
    [confirm, loadAutomations, t.common.cancel, t.common.delete, t.common.deleteAutomation, tt]
  )

  const handleToggleEnabled = useCallback(
    async (automation: Automation, enabled: boolean) => {
      await db.setAutomationEnabled(automation.id, enabled)
      await loadAutomations()
    },
    [loadAutomations]
  )

  const handleRunNow = useCallback(
    async (automation: Automation) => {
      await db.runAutomationNow(automation.id)
      await refreshAutomationRuns(automation.id)
      await loadAutomations()
    },
    [loadAutomations, refreshAutomationRuns]
  )

  const handleSubmit = useCallback(
    async (input: CreateAutomationRequest) => {
      setSaving(true)
      try {
        if (editingAutomation) {
          await db.updateAutomation(editingAutomation.id, input)
          await refreshAutomationRuns(editingAutomation.id)
        } else {
          await db.createAutomation(input)
        }
        await loadAutomations()
      } finally {
        setSaving(false)
      }
    },
    [editingAutomation, loadAutomations, refreshAutomationRuns]
  )

  return (
    <PageFrame>
      <PageHeader
        title="Automations"
        subtitle={currentProject?.name || '请先选择项目'}
        actions={
          <div className="flex items-center gap-2">
            <input
              className="h-9 w-64 rounded-full border border-border/80 bg-background/90 px-4 text-sm"
              placeholder="搜索规则"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <Button onClick={handleCreate} disabled={!currentProject?.id}>
              <Plus className="mr-1 size-4" />
              新建规则
            </Button>
          </div>
        }
      />

      <PageBody className="space-y-5">
        {!currentProject?.id ? (
          <EmptyStatePanel
            title="请先选择项目"
            description="请先在左侧选择当前项目，再创建自动化规则。"
            className="min-h-[160px]"
          />
        ) : null}

        <AutomationList
          automations={filteredAutomations}
          runsByAutomationId={runsByAutomationId}
          runsLoadingByAutomationId={runsLoadingByAutomationId}
          loading={loading}
          onRunNow={handleRunNow}
          onToggleEnabled={handleToggleEnabled}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenTask={(taskId) => navigate(`/task/${taskId}`)}
        />
      </PageBody>

      <AutomationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setDialogOpen(open)
          }
        }}
        initialAutomation={editingAutomation}
        cliConfigs={cliConfigs}
        onSubmit={handleSubmit}
      />
    </PageFrame>
  )
}
