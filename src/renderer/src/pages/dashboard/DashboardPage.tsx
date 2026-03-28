import { useNavigate } from 'react-router-dom'
import { useProjects } from '@features/projects'
import { useDashboardData } from '@features/home'
import { PageBody, PageFrame, PageHeader } from '@/components/shared/page-shell'
import { SummaryCards } from './components/SummaryCards'
import { ActivityList } from './components/ActivityList'
import { EmptyState } from './components/EmptyState'

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentProject } = useProjects()

  const { tasks, summary, activityItems, loading } = useDashboardData(currentProject?.id)

  const hasTasks = tasks.length > 0

  const handleSelectActivity = (taskId: string) => {
    navigate(`/task/${taskId}`)
  }

  return (
    <PageFrame>
      <PageHeader title="Dashboard" subtitle={currentProject ? currentProject.name : '全部项目'} />
      <PageBody className="space-y-6">
        {!loading && !hasTasks && <EmptyState />}
        <SummaryCards counts={summary} loading={loading} />
        <ActivityList items={activityItems} loading={loading} onSelect={handleSelectActivity} />
      </PageBody>
    </PageFrame>
  )
}
