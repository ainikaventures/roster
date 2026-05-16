'use client';

import * as React from 'react';
import { addWeeks, format, subWeeks } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@roster/ui';
import { durationMinutes, fmtDuration, fmtTime, weekFor } from '@/lib/week';

type TimeEntry = {
  id: string;
  teamId: string;
  userId: string;
  clockedIn: string;
  clockedOut: string | null;
  approved: boolean;
  notes: string | null;
  team: { name: string; color: string | null };
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  breaks: { id: string; startedAt: string; endedAt: string | null; paid: boolean }[];
};

export function Timesheet({ scope }: { scope: 'self' | 'manager' }) {
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [showAll, setShowAll] = React.useState(scope === 'self');
  const week = weekFor(anchor);
  const qc = useQueryClient();

  const entries = useQuery({
    queryKey: ['time-entries', week.start.toISOString(), week.end.toISOString(), showAll],
    queryFn: async (): Promise<TimeEntry[]> => {
      const params = new URLSearchParams({
        from: week.start.toISOString(),
        to: week.end.toISOString(),
      });
      if (showAll && scope === 'self') params.set('onlyMine', 'true');
      if (!showAll && scope === 'manager') params.set('onlyMine', 'true');
      const res = await fetch(`/api/time/entries?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const approve = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const res = await fetch(`/api/time/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });

  const totalMinutes = (entries.data ?? []).reduce(
    (acc, e) => acc + entryMinutes(e),
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base">Timesheet</CardTitle>
        <div className="flex items-center gap-2">
          {scope === 'manager' && (
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={!showAll}
                onChange={(e) => setShowAll(!e.target.checked)}
              />
              Only mine
            </label>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAnchor((d) => subWeeks(d, 1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-xs font-medium tabular-nums">
              {week.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAnchor((d) => addWeeks(d, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{fmtDuration(totalMinutes)}</span>
        </div>

        {(entries.data ?? []).length === 0 && !entries.isLoading && (
          <p className="text-sm text-muted-foreground">No entries this week.</p>
        )}

        <ul className="divide-y rounded-md border">
          {(entries.data ?? []).map((entry) => {
            const minutes = entryMinutes(entry);
            const initials =
              entry.user.name
                ?.split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('') ?? entry.user.email[0]?.toUpperCase() ?? '?';
            return (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {entry.user.name ?? entry.user.email}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {entry.team.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(entry.clockedIn), 'EEE MMM d')} ·{' '}
                      {fmtTime(entry.clockedIn)} –{' '}
                      {entry.clockedOut ? fmtTime(entry.clockedOut) : 'now'}
                      {entry.breaks.length > 0 && (
                        <>
                          {' '}· {entry.breaks.length} break
                          {entry.breaks.length === 1 ? '' : 's'}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">{fmtDuration(minutes)}</span>
                  {entry.approved ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" /> Approved
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  {scope === 'manager' && entry.clockedOut && (
                    <Button
                      size="sm"
                      variant={entry.approved ? 'ghost' : 'outline'}
                      onClick={() =>
                        approve.mutate({ id: entry.id, approved: !entry.approved })
                      }
                    >
                      {entry.approved ? 'Unapprove' : 'Approve'}
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

function entryMinutes(entry: TimeEntry): number {
  const total = durationMinutes(entry.clockedIn, entry.clockedOut ?? new Date());
  const breakMinutes = entry.breaks
    .filter((b) => !b.paid)
    .reduce(
      (acc, b) => acc + durationMinutes(b.startedAt, b.endedAt ?? new Date()),
      0,
    );
  return Math.max(0, total - breakMinutes);
}
