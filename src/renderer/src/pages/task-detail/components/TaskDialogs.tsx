import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { LanguageStrings } from '../types';

type CLIToolInfo = {
  id: string;
  name?: string;
  displayName?: string;
};

type AgentToolConfigOption = {
  id: string;
  name: string;
};

interface TaskDialogsProps {
  t: LanguageStrings;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editPrompt: string;
  setEditPrompt: (value: string) => void;
  editCliToolId: string;
  setEditCliToolId: (value: string) => void;
  editCliConfigId: string;
  setEditCliConfigId: (value: string) => void;
  cliTools: CLIToolInfo[];
  cliConfigs: AgentToolConfigOption[];
  onSaveEdit: () => void;
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  onDelete: () => void;
}

export function TaskDialogs({
  t,
  isEditOpen,
  setIsEditOpen,
  editPrompt,
  setEditPrompt,
  editCliToolId,
  setEditCliToolId,
  editCliConfigId,
  setEditCliConfigId,
  cliTools,
  cliConfigs,
  onSaveEdit,
  isDeleteOpen,
  setIsDeleteOpen,
  onDelete,
}: TaskDialogsProps) {
  return (
    <>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {`${t.common.edit} ${t.task.taskInfo || 'Task'}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createPromptLabel}
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="border-input bg-background text-foreground w-full resize-none rounded-md border px-3 py-2 text-sm"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createCliLabel}
              </label>
              <Select
                value={editCliToolId}
                onValueChange={setEditCliToolId}
                placeholder={t.task.createCliPlaceholder}
                options={cliTools.map((tool) => ({
                  value: tool.id,
                  label: tool.displayName || tool.name || tool.id,
                }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.task.createCliConfigLabel || 'CLI 配置项'}
              </label>
              <Select
                value={editCliConfigId}
                disabled={!editCliToolId || cliConfigs.length === 0}
                onValueChange={setEditCliConfigId}
                placeholder={t.task.createCliConfigPlaceholder || '请选择 CLI 配置项'}
                options={cliConfigs.map((config) => ({
                  value: config.id,
                  label: config.name,
                }))}
              />
              {!editCliToolId && (
                <p className="text-muted-foreground text-xs">
                  {t.task.createCliConfigSelectTool || '请先选择 CLI 工具'}
                </p>
              )}
              {editCliToolId && cliConfigs.length === 0 && (
                <p className="text-amber-500 text-xs">
                  {t.task.createCliConfigEmpty || '请先创建 CLI 配置项'}
                </p>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={onSaveEdit}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.deleteTask}</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground text-sm">
            <p>{t.common.deleteTaskConfirm}</p>
            <p className="mt-2">{t.common.deleteTaskDescription}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
