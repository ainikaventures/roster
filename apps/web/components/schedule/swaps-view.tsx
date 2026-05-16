'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
} from '@roster/ui';

type Swap = {
  id: string;
  status: 'PENDING_RECIPIENT' | 'PENDING_MANAGER' | 'APPROVED' | 'DENIED' | 'CANCELED';
  reason: string | null;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  shift: {
    id: string;
    startsAt: string;
    endsAt: string;
    team: { id: string; name: string; color: string | null };
  };
  requester: { id: string; name: string | null; email: string };
  recipient: { id: string; name: string | null; email: string } | null;
  reviewer: { id: string; name: string | null; email: string } | null;
};

export function SwapsView({ userId, canApprove }: { userId: string; canApprove: boolean }) {
  const qc = useQueryClient();

  const swaps = useQuery({
    queryKey: ['swaps'],
    queryFn: async (): Promise<Swap[]> => {
      const res = await fetch('/api/swaps');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'accept' | 'decline' | 'approve' | 'deny' | 'cancel';
    }) => {
      const res = await fetch(`/api/swaps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swaps'] }),
  });

  const items = swaps.data ?? [];

  return (
    <Card>
      <CardContent className="p-0">
        {items.length === 0 && !swaps.isLoading && (
          <p className="p-8 text-center text-sm text-muted-foreground">No swap requests.</p>
        )}
        <ul className="divide-y">
          {items.map((s) => {
            const isRecipient = s.recipient?.id === userId;
            const isRequester = s.requester.id === userId;
            const requesterInitials = initials(s.requester.name, s.requester.email);
            const recipientInitials = s.recipient
              ? initials(s.recipient.name, s.recipient.email)
              : null;

            return (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">{requesterInitials}</AvatarFallback>
                    </Avatar>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {s.recipient ? (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">{recipientInitials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Open</Badge>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {s.requester.name ?? s.requester.email}
                      </span>
                      {s.recipient && (
                        <>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="text-sm">
                            {s.recipient.name ?? s.recipient.email}
                          </span>
                        </>
                      )}
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.shift.team.name} ·{' '}
                      {format(new Date(s.shift.startsAt), 'EEE MMM d, p')} –{' '}
                      {format(new Date(s.shift.endsAt), 'p')}
                    </p>
                    {s.reason && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{s.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {s.status === 'PENDING_RECIPIENT' && isRecipient && (
                    <>
                      <Button size="sm" onClick={() => act.mutate({ id: s.id, action: 'accept' })}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: s.id, action: 'decline' })}>
                        Decline
                      </Button>
                    </>
                  )}
                  {s.status === 'PENDING_MANAGER' && canApprove && (
                    <>
                      <Button size="sm" onClick={() => act.mutate({ id: s.id, action: 'approve' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: s.id, action: 'deny' })}>
                        Deny
                      </Button>
                    </>
                  )}
                  {['PENDING_RECIPIENT', 'PENDING_MANAGER'].includes(s.status) && isRequester && (
                    <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: s.id, action: 'cancel' })}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Swap['status'] }) {
  const variants: Record<
    Swap['status'],
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    PENDING_RECIPIENT: { variant: 'outline', label: 'Waiting on teammate' },
    PENDING_MANAGER: { variant: 'outline', label: 'Awaiting manager' },
    APPROVED: { variant: 'secondary', label: 'Approved' },
    DENIED: { variant: 'destructive', label: 'Denied' },
    CANCELED: { variant: 'outline', label: 'Canceled' },
  };
  return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
}

function initials(name: string | null, email: string): string {
  return (
    name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('') ?? email[0]?.toUpperCase() ?? '?'
  );
}
