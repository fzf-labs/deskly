import { cn } from '@/lib/utils';
import { taskStatusUi } from '@/lib/task-status';
import { type Task, type TaskStatus } from '@/data';
import {
  GitBranch,
  FolderGit2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskMetadataPanelProps {
  task: Task | null;
  cliToolId?: string | null;
  onStatusChange?: (status: TaskStatus) => void;
  onOpenWorktree?: () => void;
  className?: string;
}

export function TaskMetadataPanel({
  task,
  cliToolId,
  onStatusChange: _onStatusChange,
  onOpenWorktree,
  className,
}: TaskMetadataPanelProps) {
  if (!task) return null;

  const config = taskStatusUi[task.status];
  const StatusIcon = config?.icon || Clock;

  return (
    <div className={cn('space-y-3 p-3', className)}>
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          Status
        </span>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
            config?.badgeColor
          )}
        >
          <StatusIcon className="size-3" />
          {config?.label || task.status}
        </div>
      </div>

      {/* Branch Info */}
      {task.branch_name && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            Branch
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <GitBranch className="text-muted-foreground size-3" />
            <code className="bg-muted rounded px-1.5 py-0.5">
              {task.branch_name}
            </code>
          </div>
        </div>
      )}

      {/* Worktree Path */}
      {task.worktree_path && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Worktree
            </span>
            {onOpenWorktree && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onOpenWorktree}
              >
                <ExternalLink className="mr-1 size-3" />
                Open
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FolderGit2 className="text-muted-foreground size-3 shrink-0" />
            <code className="bg-muted truncate rounded px-1.5 py-0.5">
              {task.worktree_path}
            </code>
          </div>
        </div>
      )}

      {/* Workspace Path */}
      {task.workspace_path && !task.worktree_path && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Workspace
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FolderGit2 className="text-muted-foreground size-3 shrink-0" />
            <code className="bg-muted truncate rounded px-1.5 py-0.5">
              {task.workspace_path}
            </code>
          </div>
        </div>
      )}

      {/* CLI Tool */}
      {cliToolId && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            CLI
          </span>
          <div className="text-xs font-mono">{cliToolId}</div>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-border/50 space-y-1.5 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Created</span>
          <span className="text-xs">
            {new Date(task.created_at).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Updated</span>
          <span className="text-xs">
            {new Date(task.updated_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
