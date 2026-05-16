'use client';

import * as React from 'react';
import { format } from 'date-fns';
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
import type { TeamMember } from './types';

type Team = { id: string; name: string; color: string | null; branchId: string };

export function NewShiftDialog({
  open,
  onOpenChange,
  day,
  teamId: initialTeamId,
  teams,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  teamId: string;
  teams: Team[];
  onCreated: () => void;
}) {
  const [teamId, setTeamId] = React.useState(initialTeamId);
  const [startsAt, setStartsAt] = React.useState(() =>
    formatDateTimeLocal(setHM(day, 9, 0)),
  );
  const [endsAt, setEndsAt] = React.useState(() => formatDateTimeLocal(setHM(day, 17, 0)));
  const [userId, setUserId] = React.useState<string>('');
  const [notes, setNotes] = React.useState('');
  const [publishNow, setPublishNow] = React.useState(false);
  const [openShift, setOpenShift] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const members = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch(`/api/users?teamId=${encodeURIComponent(teamId)}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed to load');
      return body.data;
    },
    enabled: !!teamId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New shift</DialogTitle>
          <DialogDescription>{format(day, 'EEEE, MMM d')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSubmitting(true);
            const res = await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                teamId,
                userId: openShift ? null : userId || null,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                notes: notes.trim() || undefined,
                publish: publishNow,
                isOpen: openShift,
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed to create shift');
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
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="starts">Starts</Label>
              <Input
                id="starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ends">Ends</Label>
              <Input
                id="ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="assignee">Assignee</Label>
            <select
              id="assignee"
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={!members.data || openShift}
            >
              <option value="">Unassigned</option>
              {(members.data ?? []).map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={openShift}
                onChange={(e) => setOpenShift(e.target.checked)}
              />
              Open shift (claim-based)
            </label>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="mt-1.5"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
            />
            Publish immediately (notifies the team)
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create shift'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function setHM(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
