import { useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import { useAppShell, useSidebar } from '@/components/layout'
import { ToolSelectionContext } from '@/components/task'
import { useAgent } from '@features/cli-session'

import { ExecutionPanel } from './components/ExecutionPanel'
import { ReplyCard } from './components/ReplyCard'
import { RightPanelSection } from './components/RightPanelSection'
import { TaskDetailHeader } from './components/TaskDetailHeader'
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
  const initialStartError = state?.startError

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
    initialStartError,
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
        visible: false,
        width: 'clamp(360px, 40vw, 920px)',
        variant: 'detail' as const
      }
    }),
    []
  )

  useAppShell(shellConfig)

  return (
    <ToolSelectionContext.Provider value={detail.toolSelectionValue}>
      <div ref={containerRef} className="flex h-full min-w-0 overflow-hidden">
        <div
          className={cn('bg-background flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl')}
        >
          <div className="shrink-0">
            <TaskDetailHeader
              t={t}
              title={detail.displayTitle || `Task ${taskId}`}
              metaRows={detail.visibleMetaRows}
              showActionButton={detail.showActionButton}
              actionDisabled={detail.actionDisabled}
              actionKind={detail.actionKind}
              actionLabel={detail.actionLabel}
              onAction={handleAction}
              onToggleSidebar={toggleLeft}
              activePanelTab={detail.isPreviewVisible ? detail.activePreviewTab : null}
              onTogglePanelTab={detail.handleTogglePreviewTab}
              onEdit={detail.handleOpenEdit}
              onDelete={() => detail.setIsDeleteOpen(true)}
              canEdit={detail.task?.status === 'todo'}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full min-w-0">
              <div className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                  <div className="min-h-0 shrink-0">
                    {detail.showWorkflowCard && (
                      <WorkflowCard
                        t={t}
                        graph={detail.workflowGraph}
                        summary={detail.workflowSummary}
                        expanded={detail.isWorkflowExpanded}
                        currentTaskNode={detail.currentTaskNode}
                        selectedNodeId={detail.selectedWorkflowNodeId}
                        onSelectNode={detail.handleSelectWorkflowNode}
                        onToggleExpanded={detail.toggleWorkflowExpanded}
                        onApproveCurrent={detail.handleApproveTaskNode}
                      />
                    )}
                  </div>

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
                    className="min-h-0 flex-1"
                  />
                </div>

                <div className="border-border/60 bg-background/95 shrink-0 border-t p-3 backdrop-blur">
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

              <aside
                className={cn(
                  'border-border/70 bg-background/94 flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden border-l backdrop-blur-xl',
                  'transition-[width,opacity,transform,border-color] duration-300',
                  detail.isPreviewVisible
                    ? 'translate-x-0 opacity-100'
                    : 'pointer-events-none translate-x-3 opacity-0 border-transparent'
                )}
                aria-hidden={!detail.isPreviewVisible}
                style={{ width: detail.isPreviewVisible ? 'clamp(360px, 40vw, 920px)' : 0 }}
              >
                <RightPanelSection
                  isVisible={detail.isPreviewVisible}
                  taskId={taskId ?? null}
                  workingDir={detail.workingDir}
                  branchName={detail.task?.branch_name || null}
                  baseBranch={detail.task?.base_branch || null}
                  activeTab={detail.activePreviewTab}
                  selectedArtifact={detail.selectedArtifact}
                  artifacts={detail.artifacts}
                  onSelectArtifact={detail.handleSelectArtifact}
                  workspaceRefreshToken={detail.workspaceRefreshToken}
                  onClosePanel={detail.handleClosePreviewPanel}
                  onClosePreview={detail.handleClosePreview}
                />
              </aside>
            </div>
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
