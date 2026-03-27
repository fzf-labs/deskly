import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles } from 'lucide-react'

import { Select } from '@/components/ui/select'
import { TaskComposer } from '@/components/task'
import { useProjects } from '@/hooks/useProjects'
import { useLanguage } from '@/providers/language-provider'
import { GENERATED_WORKFLOW_REVIEW_ROUTE } from '@/components/task/task-create-utils'

export function TasksPage() {
  const navigate = useNavigate()
  const { currentProject, currentProjectId, projects, setCurrentProjectId } = useProjects()
  const { t } = useLanguage()
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name
  }))

  useEffect(() => {
    if (currentProjectId || projects.length === 0) {
      return
    }

    setCurrentProjectId(projects[0].id)
  }, [currentProjectId, projects, setCurrentProjectId])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_26%),linear-gradient(180deg,#fbfcff_0%,#f5f7fb_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0))]" />

      <div className="relative flex flex-1 flex-col overflow-auto px-6 py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
          <div className="mb-10 flex flex-col items-center gap-5 text-center">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/92 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Bot className="size-3.5" />
              <Select
                value={currentProjectId ?? ''}
                onValueChange={setCurrentProjectId}
                options={projectOptions}
                disabled={projectOptions.length === 0}
                ariaLabel="Select current project"
                triggerClassName="h-auto w-auto min-w-0 max-w-[min(28rem,calc(100vw-5rem))] border-0 bg-transparent px-0 py-0 text-xs font-medium text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
                contentClassName="min-w-[220px]"
              />
            </div>
            <div className="flex size-16 items-center justify-center rounded-[22px] border border-white/80 bg-white/88 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <Sparkles className="size-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
                {t.home.welcomeTitle}
              </h1>
              <p className="text-muted-foreground text-lg font-medium md:text-xl">
                {currentProject?.path || 'A calmer coding workspace for your projects'}
              </p>
            </div>
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              {t.home.welcomeSubtitle}
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <TaskComposer
              projectId={currentProject?.id}
              projectName={currentProject?.name}
              projectPath={currentProject?.path}
              projectType={currentProject?.projectType}
              promptPlaceholder={t.home.inputPlaceholder}
              className="w-full"
              autoFocus
              onOpenGeneratedWorkflowReview={async (request) => {
                navigate(GENERATED_WORKFLOW_REVIEW_ROUTE, {
                  state: {
                    ...request,
                    returnTo: '/tasks'
                  }
                })
              }}
              onCreated={async (task, context) => {
                navigate(`/task/${(task as { id: string }).id}`, {
                  state: {
                    prompt: context.prompt,
                    attachments: context.attachments,
                    startError: context.startError
                  }
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
