import { useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAgent } from '@/hooks/useAgent'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import { useAppShell, useSidebar } from '@/components/layout'
import { ToolSelectionContext } from '@/components/task'

import { ExecutionPanel } from './components/ExecutionPanel'
import { ReplyCard } from './components/ReplyCard'
import { RightPanelSection } from './components/RightPanelSection'
import { TaskCard } from './components/TaskCard'
import { TaskDialogs } from './components/TaskDialogs'
import { WorkflowCard } from './components/WorkflowCard'
import { useTaskDetail } from './useTaskDetail'
import type { LocationState } from './types'

export function TaskDetailContainer() {
  const { t } = useLanguage()
  const { taskId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null
  const initialPrompt = state?.prompt || ''
  const initialSessionId = state?.sessionId

  const {
    taskId: activeTaskId,
    messages,
    setMessages,
    isRunning,
    stopAgent,
    loadTask,
    loadMessages,
    phase,
    approvePlan,
    rejectPlan,
    sessionFolder
  } = useAgent()
  const { toggleLeft } = useSidebar()

  const containerRef = useRef<HTMLDivElement>(null)

  // Single consolidated hook for all task detail logic
  const detail = useTaskDetail({
    taskId,
    initialPrompt,
    initialSessionId,
    navigate,
    activeTaskId,
    messages,
    setMessages,
    isRunning,
    stopAgent,
    loadTask,
    loadMessages,
    sessionFolder,
    t
  })

  const handleAction = detail.isCliTaskReviewPending
    ? detail.handleApproveCliTask
    : detail.handleStartTask

  const shellConfig = useMemo(
    () => ({
      right: {
        content: (
          <RightPanelSection
            isVisible={detail.isPreviewVisible}
            taskId={taskId ?? null}
            workingDir={detail.workingDir}
            branchName={detail.task?.branch_name || null}
            baseBranch={detail.task?.base_branch || null}
            selectedArtifact={detail.selectedArtifact}
            artifacts={detail.artifacts}
            onSelectArtifact={detail.handleSelectArtifact}
            workspaceRefreshToken={detail.workspaceRefreshToken}
            onClosePreview={detail.handleClosePreview}
          />
        ),
        visible: detail.isPreviewVisible,
        width: 'clamp(360px, 40vw, 920px)',
        variant: 'detail' as const
      }
    }),
    [
      detail.artifacts,
      detail.handleClosePreview,
      detail.handleSelectArtifact,
      detail.isPreviewVisible,
      detail.selectedArtifact,
      detail.task?.base_branch,
      detail.task?.branch_name,
      detail.workingDir,
      detail.workspaceRefreshToken,
      taskId
    ]
  )

  useAppShell(shellConfig)

  return (
    <ToolSelectionContext.Provider value={detail.toolSelectionValue}>
      <div ref={containerRef} className="flex h-full min-w-0 overflow-hidden">
        <div
          className={cn('bg-background flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl')}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <TaskCard
              t={t}
              title={detail.displayTitle || `Task ${taskId}`}
              metaRows={detail.visibleMetaRows}
              showActionButton={detail.showActionButton}
              actionDisabled={detail.actionDisabled}
              actionLabel={detail.actionLabel}
              onAction={handleAction}
              onToggleSidebar={toggleLeft}
              onEdit={detail.handleOpenEdit}
              onDelete={() => detail.setIsDeleteOpen(true)}
              canEdit={detail.task?.status === 'todo'}
            />

            {detail.showWorkflowCard && (
              <WorkflowCard
                t={t}
                graph={detail.workflowGraph}
                currentTaskNode={detail.currentTaskNode}
                selectedNodeId={detail.selectedWorkflowNodeId}
                onSelectNode={detail.handleSelectWorkflowNode}
                onApproveCurrent={detail.handleApproveTaskNode}
              />
            )}

            <ExecutionPanel
              t={t}
              isLoading={detail.isLoading}
              pipelineBanner={detail.pipelineBanner}
              useCliSession={detail.showExecutionLogPanel}
              cliStatusInfo={detail.cliStatusInfo}
              cliToolLabel={detail.cliToolLabel}
              messages={messages}
              phase={phase}
              onApprovePlan={approvePlan}
              onRejectPlan={rejectPlan}
              isRunning={isRunning}
              taskId={taskId ?? null}
              taskNodeId={detail.executionTaskNodeId}
              logTaskNodeId={detail.executionLogTaskNodeId}
              logSource={detail.executionLogSource}
              logToolId={detail.executionLogToolId}
              sessionId={detail.executionSessionId}
              toolId={detail.executionCliToolId}
              configId={detail.agentToolConfigId}
              workingDir={detail.workingDir}
              prompt={detail.taskPrompt}
              cliSessionRef={detail.cliSessionRef}
              onCliStatusChange={detail.handleCliStatusChange}
              messagesContainerRef={detail.messagesContainerRef}
              messagesEndRef={detail.messagesEndRef}
            />

            <ReplyCard
              t={t}
              isRunning={detail.replyIsRunning}
              disabled={detail.replyDisabled}
              placeholder={detail.replyPlaceholder}
              onStop={detail.handleStopExecution}
              onSubmit={detail.handleReply}
            />
          </div>
        </div>
      </div>

      <TaskDialogs
        t={t}
        isEditOpen={detail.isEditOpen}
        setIsEditOpen={detail.setIsEditOpen}
        editPrompt={detail.editPrompt}
        setEditPrompt={detail.setEditPrompt}
        editCliToolId={detail.editCliToolId}
        setEditCliToolId={detail.setEditCliToolId}
        editCliConfigId={detail.editCliConfigId}
        setEditCliConfigId={detail.setEditCliConfigId}
        cliTools={detail.cliTools}
        cliConfigs={detail.cliConfigs}
        onSaveEdit={detail.handleSaveEdit}
        isDeleteOpen={detail.isDeleteOpen}
        setIsDeleteOpen={detail.setIsDeleteOpen}
        onDelete={detail.handleDeleteTask}
      />
    </ToolSelectionContext.Provider>
  )
}
