'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import { Check, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from '@roster/ui';
import { NewTaskDialog } from './new-task-dialog';
import { CompleteTaskDialog } from './complete-task-dialog';
import type { Task } from './types';

type Team = { id: string; name: string; color: string | null; branchId: string };

export function TasksView({
  userId,
  canEdit,
  teams,
}: {
  userId: string;
  canEdit: boolean;
  teams: Team[];
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<'all' | 'mine' | 'open' | 'done'>('open');
  const [creating, setCreating] = React.useState(false);
  const [completing, setCompleting] = React.useState<Task | null>(null);

  const tasks = useQuery({
    queryKey: ['tasks', filter],
    queryFn: async (): Promise<Task[]> => {
      const params = new URLSearchParams();
      if (filter === 'mine') params.set('mine', 'true');
      if (filter === 'open') params.set('status', 'OPEN');
      if (filter === 'done') params.set('status', 'DONE');
      const res = await fetch(`/api/tasks?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 30_000,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Daily checklists, one-offs, and recurring routines.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)} disabled={teams.length === 0}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New task
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'open', label: 'Open' },
            { id: 'mine', label: 'Assigned to me' },
            { id: 'done', label: 'Done' },
            { id: 'all', label: 'All' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              filter === tab.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {(tasks.data ?? []).length === 0 && !tasks.isLoading && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No tasks here.
            </p>
          )}
          <ul className="divide-y">
            {(tasks.data ?? []).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                userId={userId}
                canEdit={canEdit}
                onComplete={() => setCompleting(task)}
                onArchive={() => archive.mutate(task.id)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && (
        <NewTaskDialog
          open
          onOpenChange={(o) => setCreating(o)}
          teams={teams}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['tasks'] });
          }}
        />
      )}

      {completing && (
        <CompleteTaskDialog
          open
          task={completing}
          onOpenChange={(o) => !o && setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            qc.invalidateQueries({ queryKey: ['tasks'] });
          }}
        />
      )}
    </>
  );
}

function TaskRow({
  task,
  userId,
  canEdit,
  onComplete,
  onArchive,
}: {
  task: Task;
  userId: string;
  canEdit: boolean;
  onComplete: () => void;
  onArchive: () => void;
}) {
  const overdue = task.dueAt && task.status !== 'DONE' && isPast(new Date(task.dueAt));
  const recurring = task.recurrence !== 'NONE';
  const isMine = task.assignedUserId === userId;
  const lastCompleted = task.completions[0]?.completedAt;

  const assigneeInitials = task.assignee
    ? task.assignee.name
        ?.split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('') ?? task.assignee.email[0]?.toUpperCase() ?? '?'
    : null;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.team.color ?? 'hsl(var(--muted-foreground))' }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                task.status === 'DONE' && 'text-muted-foreground line-through',
              )}
            >
              {task.title}
            </span>
            {recurring && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Repeat className="h-3 w-3" /> {task.recurrence.toLowerCase()}
              </Badge>
            )}
            {task.priority !== 'NORMAL' && <PriorityBadge priority={task.priority} />}
            {overdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{task.team.name}</span>
            {task.dueAt && (
              <span>Due {format(new Date(task.dueAt), 'MMM d, p')}</span>
            )}
            {recurring && lastCompleted && (
              <span>
                Last done{' '}
                {formatDistanceToNowStrict(new Date(lastCompleted), { addSuffix: true })}
              </span>
            )}
            {task.requirePhoto || task.requireSignature || task.requireNote ? (
              <span>
                Requires:{' '}
                {[
                  task.requirePhoto && 'photo',
                  task.requireSignature && 'signature',
                  task.requireNote && 'notes',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            ) : null}
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.assignee ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            title={task.assignee.name ?? task.assignee.email}
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{assigneeInitials}</AvatarFallback>
            </Avatar>
            {isMine ? 'You' : task.assignee.name ?? task.assignee.email}
          </span>
        ) : (
          <Badge variant="outline">Unassigned</Badge>
        )}
        {(task.status === 'OPEN' || task.status === 'IN_PROGRESS' || recurring) && (
          <Button size="sm" variant="outline" onClick={onComplete}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {recurring ? 'Log completion' : 'Mark done'}
          </Button>
        )}
        {canEdit && task.status !== 'ARCHIVED' && (
          <button
            type="button"
            onClick={onArchive}
            aria-label="Archive task"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const styles: Record<Task['priority'], string> = {
    LOW: 'border-blue-500 text-blue-600',
    NORMAL: '',
    HIGH: 'border-amber-500 text-amber-700',
    URGENT: 'border-rose-500 text-rose-700',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase', styles[priority])}>
      {priority.toLowerCase()}
    </Badge>
  );
}
