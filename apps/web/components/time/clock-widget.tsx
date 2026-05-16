'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coffee, Play, Square } from 'lucide-react';
import { Button, Card, CardContent } from '@roster/ui';
import { durationMinutes, fmtDuration, fmtTime } from '@/lib/week';

type CurrentEntry = {
  id: string;
  teamId: string;
  clockedIn: string;
  clockedOut: string | null;
  breaks: { id: string; startedAt: string; endedAt: string | null; paid: boolean }[];
} | null;

export function ClockWidget() {
  const qc = useQueryClient();

  const current = useQuery({
    queryKey: ['time-current'],
    queryFn: async () => {
      const res = await fetch('/api/time/current');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return (body.data.entry as CurrentEntry) ?? null;
    },
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['time-current'] });
    qc.invalidateQueries({ queryKey: ['time-entries'] });
  };

  const clockIn = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: invalidate,
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/clock-out', { method: 'POST' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: invalidate,
  });

  const startBreak = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/breaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: false }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: invalidate,
  });

  const endBreak = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/breaks', { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: invalidate,
  });

  const entry = current.data;
  const onBreak = !!entry?.breaks.find((b) => !b.endedAt);
  const error =
    (clockIn.error as Error | null)?.message ??
    (clockOut.error as Error | null)?.message ??
    (startBreak.error as Error | null)?.message ??
    (endBreak.error as Error | null)?.message ??
    null;

  return (
    <Card>
      <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
        <div>
          {entry ? (
            <>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {onBreak ? 'On break since' : 'Clocked in at'}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {fmtTime(
                  onBreak
                    ? entry.breaks.find((b) => !b.endedAt)!.startedAt
                    : entry.clockedIn,
                )}
              </div>
              <LiveDuration startIso={onBreak ? entry.breaks.find((b) => !b.endedAt)!.startedAt : entry.clockedIn} />
            </>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Not clocked in
              </div>
              <div className="text-2xl font-semibold">Ready when you are</div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {entry ? (
            <>
              {onBreak ? (
                <Button variant="outline" onClick={() => endBreak.mutate()}>
                  <Coffee className="mr-1.5 h-4 w-4" /> End break
                </Button>
              ) : (
                <Button variant="outline" onClick={() => startBreak.mutate()}>
                  <Coffee className="mr-1.5 h-4 w-4" /> Start break
                </Button>
              )}
              <Button variant="destructive" onClick={() => clockOut.mutate()}>
                <Square className="mr-1.5 h-4 w-4" /> Clock out
              </Button>
            </>
          ) : (
            <Button onClick={() => clockIn.mutate()} disabled={clockIn.isPending}>
              <Play className="mr-1.5 h-4 w-4" />
              {clockIn.isPending ? 'Starting…' : 'Clock in'}
            </Button>
          )}
        </div>
      </CardContent>
      {error && (
        <div className="border-t bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </Card>
  );
}

function LiveDuration({ startIso }: { startIso: string }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const minutes = durationMinutes(startIso, new Date());
  return (
    <div className="text-sm text-muted-foreground tabular-nums">
      {fmtDuration(minutes)} elapsed
    </div>
  );
}
