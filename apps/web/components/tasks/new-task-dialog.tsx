'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@roster/ui';
import type { TeamMember } from '@/components/schedule/types';

type Team = { id: string; name: string; color: string | null; branchId: string };

export function NewTaskDialog({
  open,
  onOpenChange,
  teams,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  onCreated: () => void;
}) {
  const [teamId, setTeamId] = React.useState(teams[0]?.id ?? '');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [recurrence, setRecurrence] = React.useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>(
    'NONE',
  );
  const [assignedUserId, setAssignedUserId] = React.useState<string>('');
  const [dueAt, setDueAt] = React.useState<string>('');
  const [requirePhoto, setRequirePhoto] = React.useState(false);
  const [requireSignature, setRequireSignature] = React.useState(false);
  const [requireNote, setRequireNote] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const members = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch(`/api/users?teamId=${teamId}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    enabled: !!teamId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            One-off or recurring routine for a team.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                teamId,
                assignedUserId: assignedUserId || null,
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                recurrence,
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                requirePhoto,
                requireSignature,
                requireNote,
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCreated();
          }}
        >
          <div>
            <Label htmlFor="team">Team</Label>
            <select
              id="team"
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              required
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="desc">Description</Label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-md border bg-background p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')
                }
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <Label htmlFor="recurrence">Repeats</Label>
              <select
                id="recurrence"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={recurrence}
                onChange={(e) =>
                  setRecurrence(
                    e.target.value as 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
                  )
                }
              >
                <option value="NONE">One-off</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <select
                id="assignee"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                disabled={!members.data}
              >
                <option value="">Unassigned</option>
                {(members.data ?? []).map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="due">Due</Label>
              <Input
                id="due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Required to complete
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireNote}
                onChange={(e) => setRequireNote(e.target.checked)}
              />
              Note from completer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requirePhoto}
                onChange={(e) => setRequirePhoto(e.target.checked)}
              />
              Photo (camera capture)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireSignature}
                onChange={(e) => setRequireSignature(e.target.checked)}
              />
              Signature
            </label>
            <p className="text-xs text-muted-foreground">
              File uploads to S3 land in Phase 4; for now, evidence is stored as base64.
            </p>
          </fieldset>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim() || !teamId}>
              {submitting ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
