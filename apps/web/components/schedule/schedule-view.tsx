'use client';

import * as React from 'react';
import { addWeeks, format, isSameDay, subWeeks } from 'date-fns';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';
import { Badge, Button, cn } from '@roster/ui';
import { dayKey, fmtTime, weekFor } from '@/lib/week';
import { NewShiftDialog } from './new-shift-dialog';
import type { Shift } from './types';

type Team = { id: string; name: string; color: string | null; branchId: string };

export function ScheduleView({
  teams,
  canEdit,
  userId,
}: {
  teams: Team[];
  canEdit: boolean;
  userId: string;
}) {
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [teamFilter, setTeamFilter] = React.useState<string | 'all'>('all');
  const [creatingFor, setCreatingFor] = React.useState<{ day: Date; teamId: string } | null>(
    null,
  );

  const week = weekFor(anchor);
  const qc = useQueryClient();

  const shiftsQuery = useQuery({
    queryKey: ['shifts', week.start.toISOString(), week.end.toISOString(), teamFilter],
    queryFn: async (): Promise<Shift[]> => {
      const params = new URLSearchParams({
        from: week.start.toISOString(),
        to: week.end.toISOString(),
      });
      if (teamFilter !== 'all') params.set('teamId', teamFilter);
      const res = await fetch(`/api/shifts?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed to load shifts');
      return body.data;
    },
  });

  const publish = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await fetch('/api/shifts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          from: week.start.toISOString(),
          to: week.end.toISOString(),
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed to publish');
      return body.data as { published: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Delete failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const visibleTeams =
    teamFilter === 'all' ? teams : teams.filter((t) => t.id === teamFilter);
  const shiftsByDayTeam = groupShifts(shiftsQuery.data ?? []);
  const draftCount = (shiftsQuery.data ?? []).filter((s) => !s.published).length;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAnchor((d) => subWeeks(d, 1))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[12rem] text-center text-sm font-medium">{week.label}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAnchor((d) => addWeeks(d, 1))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {teams.length > 1 && (
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filter by team"
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {canEdit && teamFilter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              disabled={publish.isPending || draftCount === 0}
              onClick={() => publish.mutate(teamFilter)}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {publish.isPending
                ? 'Publishing…'
                : `Publish ${draftCount || ''} draft${draftCount === 1 ? '' : 's'}`}
            </Button>
          )}

          {canEdit && (
            <Button
              size="sm"
              onClick={() =>
                setCreatingFor({
                  day: anchor,
                  teamId: teamFilter !== 'all' ? teamFilter : teams[0]?.id ?? '',
                })
              }
              disabled={teams.length === 0}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New shift
            </Button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="grid min-w-[900px] grid-cols-[160px_repeat(7,minmax(0,1fr))]">
          {/* Header row */}
          <div className="border-b bg-muted/40 p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team
          </div>
          {week.days.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                'border-b border-l bg-muted/40 p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                isSameDay(d, new Date()) && 'text-foreground',
              )}
            >
              <div>{format(d, 'EEE')}</div>
              <div className="text-base font-semibold normal-case tracking-normal text-foreground">
                {format(d, 'MMM d')}
              </div>
            </div>
          ))}

          {/* One row per team */}
          {visibleTeams.length === 0 && (
            <div className="col-span-8 p-6 text-center text-sm text-muted-foreground">
              No teams in your scope yet.
            </div>
          )}
          {visibleTeams.map((team) => (
            <React.Fragment key={team.id}>
              <div className="border-b p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: team.color ?? 'hsl(var(--muted-foreground))' }}
                    aria-hidden
                  />
                  {team.name}
                </div>
              </div>
              {week.days.map((d) => {
                const key = `${team.id}|${dayKey(d)}`;
                const dayShifts = shiftsByDayTeam.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="group relative min-h-[110px] border-b border-l p-1.5"
                  >
                    {dayShifts.map((s) => (
                      <ShiftCard
                        key={s.id}
                        shift={s}
                        color={team.color}
                        canEdit={canEdit}
                        isMine={s.userId === userId}
                        onDelete={() => deleteShift.mutate(s.id)}
                      />
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setCreatingFor({ day: d, teamId: team.id })}
                        className="absolute inset-x-1 bottom-1 hidden rounded-md border border-dashed py-1 text-xs text-muted-foreground hover:bg-muted group-hover:block"
                      >
                        + Add shift
                      </button>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {shiftsQuery.isLoading && (
        <p className="text-center text-sm text-muted-foreground">Loading schedule…</p>
      )}
      {shiftsQuery.error instanceof Error && (
        <p className="text-center text-sm text-destructive">{shiftsQuery.error.message}</p>
      )}

      {creatingFor && (
        <NewShiftDialog
          open
          onOpenChange={(o) => !o && setCreatingFor(null)}
          day={creatingFor.day}
          teamId={creatingFor.teamId}
          teams={teams}
          onCreated={() => {
            setCreatingFor(null);
            qc.invalidateQueries({ queryKey: ['shifts'] });
          }}
        />
      )}
    </>
  );
}

function groupShifts(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.teamId}|${dayKey(new Date(s.startsAt))}`;
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return map;
}

function ShiftCard({
  shift,
  color,
  canEdit,
  isMine,
  onDelete,
}: {
  shift: Shift;
  color: string | null;
  canEdit: boolean;
  isMine: boolean;
  onDelete: () => void;
}) {
  const bg = color ?? 'hsl(var(--primary))';
  return (
    <div
      className={cn(
        'mb-1 rounded-md border-l-4 bg-background px-2 py-1.5 text-xs shadow-sm',
        !shift.published && 'border-dashed opacity-80',
        isMine && 'ring-1 ring-primary',
      )}
      style={{ borderLeftColor: bg }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {fmtTime(shift.startsAt)} – {fmtTime(shift.endsAt)}
        </span>
        {!shift.published && (
          <Badge variant="outline" className="text-[10px]">
            Draft
          </Badge>
        )}
      </div>
      <div className="truncate text-muted-foreground">
        {shift.user?.name ?? shift.user?.email ?? 'Unassigned'}
      </div>
      {canEdit && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            className="text-[10px] text-muted-foreground hover:text-destructive"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
