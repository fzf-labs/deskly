import type { WorkflowDefinitionScope } from '@/data'

interface BuildWorkflowTemplateEditorRouteOptions {
  scope: WorkflowDefinitionScope
  templateId?: string | null
  returnTo?: string | null
}

export function buildWorkflowTemplateEditorRoute({
  scope,
  templateId,
  returnTo
}: BuildWorkflowTemplateEditorRouteOptions): string {
  const searchParams = new URLSearchParams({ scope })

  if (templateId) {
    searchParams.set('templateId', templateId)
  }

  if (returnTo) {
    searchParams.set('returnTo', returnTo)
  }

  return `/pipeline-templates/editor?${searchParams.toString()}`
}
