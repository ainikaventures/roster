'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { Plus } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from '@roster/ui';
import type { Role } from '@roster/db';
import { NewTimeOffDialog } from './new-time-off-dialog';

type Request = {
  id: string;
  userId: string;
  type: 'VACATION' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'OTHER';
  startsAt: string;
  endsAt: string;
  hours: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELED';
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  reviewer: { id: string; name: string | null; email: string } | null;
};

type PtoBalance = {
  userId: string;
  balanceMinutes: number;
  accrualPerWeek: number;
  lastAccruedAt: string | null;
};

export function TimeOffView({ role, canApprove }: { role: Role; canApprove: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<'mine' | 'team'>(canApprove ? 'team' : 'mine');
  const [creating, setCreating] = React.useState(false);

  const requests = useQuery({
    queryKey: ['time-off', tab],
    queryFn: async (): Promise<Request[]> => {
      const params = new URLSearchParams();
      if (tab === 'mine') params.set('mine', 'true');
      const res = await fetch(`/api/time-off?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const pto = useQuery({
    queryKey: ['pto', 'me'],
    queryFn: async (): Promise<PtoBalance> => {
      const res = await fetch('/api/pto');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'APPROVED' | 'DENIED' | 'CANCELED';
    }) => {
      const res = await fetch(`/api/time-off/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-off'] });
      qc.invalidateQueries({ queryKey: ['pto'] });
    },
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time off</h1>
          <p className="text-sm text-muted-foreground">
            Request, approve, and track PTO across your team.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Request time off
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your PTO balance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-baseline gap-4">
          <div>
            <div className="text-3xl font-semibold tabular-nums">
              {hoursFromMinutes(pto.data?.balanceMinutes ?? 0).toFixed(1)} h
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round((pto.data?.balanceMinutes ?? 0) / 60 / 8)} days available
            </div>
          </div>
          {pto.data && pto.data.accrualPerWeek > 0 && (
            <div className="text-xs text-muted-foreground">
              Accruing {(pto.data.accrualPerWeek / 60).toFixed(1)}h/week
            </div>
          )}
        </CardContent>
      </Card>

      {canApprove && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'team', label: 'Team requests' },
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
      )}

      <Card>
        <CardContent className="p-0">
          {(requests.data ?? []).length === 0 && !requests.isLoading && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No requests here.
            </p>
          )}
          <ul className="divide-y">
            {(requests.data ?? []).map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                canApprove={canApprove && tab === 'team'}
                onApprove={() => decide.mutate({ id: r.id, status: 'APPROVED' })}
                onDeny={() => decide.mutate({ id: r.id, status: 'DENIED' })}
                onCancel={() => decide.mutate({ id: r.id, status: 'CANCELED' })}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <ApprovedCalendar
        requests={(requests.data ?? []).filter((r) => r.status === 'APPROVED')}
      />

      {creating && (
        <NewTimeOffDialog
          open
          onOpenChange={(o) => setCreating(o)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['time-off'] });
          }}
        />
      )}
    </>
  );
}

function RequestRow({
  request,
  canApprove,
  onApprove,
  onDeny,
  onCancel,
}: {
  request: Request;
  canApprove: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
}) {
  const initials =
    request.user.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('') ?? request.user.email[0]?.toUpperCase() ?? '?';
  const days =
    differenceInCalendarDays(new Date(request.endsAt), new Date(request.startsAt)) + 1;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {request.user.name ?? request.user.email}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {request.type.toLowerCase()}
            </Badge>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(new Date(request.startsAt), 'MMM d')} –{' '}
            {format(new Date(request.endsAt), 'MMM d, yyyy')} · {days} day{days === 1 ? '' : 's'}{' '}
            · {request.hours}h
          </p>
          {request.reason && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {request.reason}
            </p>
          )}
          {request.reviewNotes && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              Manager: {request.reviewNotes}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {request.status === 'PENDING' && canApprove && (
          <>
            <Button size="sm" onClick={onApprove}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={onDeny}>
              Deny
            </Button>
          </>
        )}
        {request.status === 'PENDING' && !canApprove && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Request['status'] }) {
  const map: Record<Request['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    PENDING: { variant: 'outline', label: 'Pending' },
    APPROVED: { variant: 'secondary', label: 'Approved' },
    DENIED: { variant: 'destructive', label: 'Denied' },
    CANCELED: { variant: 'outline', label: 'Canceled' },
  };
  const v = map[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

function ApprovedCalendar({ requests }: { requests: Request[] }) {
  // Group by month-day for a simple list view. Full calendar grid view can land
  // in a later iteration; this gives a clear "who's out when" answer.
  if (requests.length === 0) return null;
  const sorted = [...requests].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approved time off</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-1.5">
              <span className="font-medium">{r.user.name ?? r.user.email}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.startsAt), 'MMM d')} – {format(new Date(r.endsAt), 'MMM d')}
              </span>
              <Badge variant="outline" className="ml-auto text-[10px] uppercase">
                {r.type.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function hoursFromMinutes(minutes: number): number {
  return minutes / 60;
}
