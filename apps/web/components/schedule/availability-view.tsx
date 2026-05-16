'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Label, cn } from '@roster/ui';

type AvailabilityRow = {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  kind: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
  note: string | null;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AvailabilityView() {
  const qc = useQueryClient();
  const [dayOfWeek, setDayOfWeek] = React.useState(1);
  const [start, setStart] = React.useState('09:00');
  const [end, setEnd] = React.useState('17:00');
  const [kind, setKind] = React.useState<'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED'>(
    'AVAILABLE',
  );
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const list = useQuery({
    queryKey: ['availability'],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const res = await fetch('/api/availability');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek,
          startMinutes: hmToMinutes(start),
          endMinutes: hmToMinutes(end),
          kind,
          note: note.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/availability/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });

  const grouped = (list.data ?? []).reduce<Record<number, AvailabilityRow[]>>((acc, row) => {
    (acc[row.dayOfWeek] ??= []).push(row);
    return acc;
  }, {});

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <Label htmlFor="day">Day</Label>
              <select
                id="day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="kind">Type</Label>
              <select
                id="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="PREFERRED">Preferred</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  add.mutate();
                }}
                disabled={add.isPending}
                className="w-full"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          {DAYS.map((d, dayIdx) => {
            const rows = grouped[dayIdx] ?? [];
            return (
              <div key={d} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rows.length === 0 && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {rows.map((r) => (
                    <span
                      key={r.id}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs',
                        r.kind === 'UNAVAILABLE' && 'border-destructive/40 bg-destructive/5',
                        r.kind === 'PREFERRED' && 'border-emerald-500/40 bg-emerald-50',
                      )}
                    >
                      <span>
                        {minutesToHm(r.startMinutes)}–{minutesToHm(r.endMinutes)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {r.kind.toLowerCase()}
                      </Badge>
                      {r.note && <span className="text-muted-foreground">{r.note}</span>}
                      <button
                        type="button"
                        onClick={() => remove.mutate(r.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}
function minutesToHm(m: number): string {
  const h = Math.floor(m / 60);
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}
