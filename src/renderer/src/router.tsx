import { createHashRouter, Navigate } from 'react-router-dom'
import {
  HomePage,
  SetupPage,
  TaskDetailPage,
  DashboardPage,
  BoardPage,
  SkillsPage,
  McpPage,
  ProjectsPage,
  PipelineTemplatesPage,
  WorkflowTemplateEditorPage,
  SettingsPage,
  TasksPage,
  AutomationsPage,
  GeneratedWorkflowReviewPage
} from '@/pages'

import { SetupGuard } from '@/components/shared/SetupGuard'
import { MainLayout } from '@/components/layout'

export const router = createHashRouter([
  {
    path: '/',
    element: (
      <SetupGuard>
        <MainLayout />
      </SetupGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/tasks" replace />
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'board',
        element: <BoardPage />
      },
      {
        path: 'tasks',
        element: <TasksPage />
      },
      {
        path: 'automations',
        element: <AutomationsPage />
      },
      {
        path: 'pipeline-templates',
        element: <PipelineTemplatesPage />
      },
      {
        path: 'pipeline-templates/editor',
        element: <WorkflowTemplateEditorPage />
      },
      {
        path: 'generated-workflow-review',
        element: <GeneratedWorkflowReviewPage />
      },
      {
        path: 'skills',
        element: <SkillsPage />
      },
      {
        path: 'mcp',
        element: <McpPage />
      },
      {
        path: 'projects',
        element: <ProjectsPage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: 'home',
        element: <HomePage />
      },
      {
        path: 'task/:taskId',
        element: <TaskDetailPage />
      }
    ]
  },
  {
    path: '/setup',
    element: (
      <SetupGuard>
        <SetupPage />
      </SetupGuard>
    )
  }
])
