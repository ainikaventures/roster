'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, Plus, Truck } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@roster/ui';
import type { TeamMember } from '@/components/schedule/types';

type Job = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  teamId: string | null;
  assignedUserId: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  team: { id: string; name: string; color: string | null } | null;
};

type Team = { id: string; name: string; color: string | null; branchId: string };

export function JobsView({
  userId,
  canEdit,
  teams,
}: {
  userId: string;
  canEdit: boolean;
  teams: Team[];
}) {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<'all' | 'mine' | 'today'>('all');
  const [creating, setCreating] = React.useState(false);

  const jobs = useQuery({
    queryKey: ['jobs', tab],
    queryFn: async (): Promise<Job[]> => {
      const params = new URLSearchParams();
      if (tab === 'mine') params.set('mine', 'true');
      const res = await fetch(`/api/jobs?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Job['status'] }) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const today = new Date().toDateString();
  const items = (jobs.data ?? []).filter((j) =>
    tab === 'today' ? new Date(j.startsAt).toDateString() === today : true,
  );

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Field dispatch — a job has a place, a time, and one assignee.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New job
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'mine', label: 'Mine' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              tab === t.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 && !jobs.isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Truck className="h-6 w-6" aria-hidden />
              <span>No jobs here.</span>
            </div>
          )}
          <ul className="divide-y">
            {items.map((j) => (
              <li
                key={j.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {j.team && (
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: j.team.color ?? 'hsl(var(--muted-foreground))',
                      }}
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{j.title}</span>
                      <StatusBadge status={j.status} />
                    </div>
                    {j.address && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {j.address}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(j.startsAt), 'EEE MMM d, p')} –{' '}
                      {format(new Date(j.endsAt), 'p')}
                      {j.assignee && (
                        <>
                          {' '}· {j.assignee.name ?? j.assignee.email}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {j.assignedUserId === userId && j.status !== 'COMPLETED' && j.status !== 'CANCELED' && (
                  <div className="flex items-center gap-2">
                    {j.status === 'SCHEDULED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: j.id, status: 'IN_PROGRESS' })}
                      >
                        Start
                      </Button>
                    )}
                    {j.status === 'IN_PROGRESS' && (
                      <Button
                        size="sm"
                        onClick={() => setStatus.mutate({ id: j.id, status: 'COMPLETED' })}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && (
        <NewJobDialog
          open
          onOpenChange={(o) => setCreating(o)}
          teams={teams}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['jobs'] });
          }}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const variants: Record<
    Job['status'],
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    SCHEDULED: { variant: 'outline', label: 'Scheduled' },
    IN_PROGRESS: { variant: 'default', label: 'In progress' },
    COMPLETED: { variant: 'secondary', label: 'Done' },
    CANCELED: { variant: 'destructive', label: 'Canceled' },
  };
  return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
}

function NewJobDialog({
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
  const [title, setTitle] = React.useState('');
  const [teamId, setTeamId] = React.useState<string>(teams[0]?.id ?? '');
  const [assignedUserId, setAssignedUserId] = React.useState<string>('');
  const [address, setAddress] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [endsAt, setEndsAt] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const members = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch(`/api/users${teamId ? `?teamId=${teamId}` : ''}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
          <DialogDescription>
            A one-off field assignment with a location and time window.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: title.trim(),
                teamId: teamId || null,
                assignedUserId: assignedUserId || null,
                address: address.trim() || undefined,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="mt-1.5"
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="team">Team</Label>
              <select
                id="team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <select
                id="assignee"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {(members.data ?? []).map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim() || !startsAt || !endsAt}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
