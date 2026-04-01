import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Project } from '@shared/contracts/project'

export function ProjectEditDialog({
  project,
  onOpenChange,
  onUpdate
}: {
  project: Project | null
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<Project>) => Promise<Project | null>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
  }, [project])

  const handleSave = async () => {
    if (!project) return
    setLoading(true)
    try {
      await onUpdate(project.id, { name, description })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">项目路径</label>
            <p className="text-sm text-muted-foreground break-all">{project.path}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加项目描述..."
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">创建时间</label>
            <p className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
