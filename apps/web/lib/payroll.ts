import { differenceInMinutes } from 'date-fns';

// ---------------------------------------------------------------------------
// Overtime & payroll math.
//
// Phase 6 ships a simple federal-style overtime rule: anything over 40 hours
// in a single week is OT @ 1.5×. Daily double-time, California / state-
// specific variants, and per-org overrides arrive in Phase 7 when we wire
// configurable rules.
//
// All durations are in minutes for consistency with TimeEntry / PtoBalance.
// ---------------------------------------------------------------------------

export const REGULAR_WEEK_MINUTES = 40 * 60;

export type ComputedTimeEntry = {
  id: string;
  userId: string;
  teamId: string;
  clockedIn: Date;
  clockedOut: Date | null;
  breaks: { startedAt: Date; endedAt: Date | null; paid: boolean }[];
};

export type EntryTotals = {
  rawMinutes: number;
  unpaidBreakMinutes: number;
  workedMinutes: number;
};

export function entryTotals(entry: ComputedTimeEntry, now: Date = new Date()): EntryTotals {
  const end = entry.clockedOut ?? now;
  const rawMinutes = Math.max(0, differenceInMinutes(end, entry.clockedIn));
  const unpaidBreakMinutes = entry.breaks
    .filter((b) => !b.paid)
    .reduce(
      (acc, b) => acc + Math.max(0, differenceInMinutes(b.endedAt ?? now, b.startedAt)),
      0,
    );
  const workedMinutes = Math.max(0, rawMinutes - unpaidBreakMinutes);
  return { rawMinutes, unpaidBreakMinutes, workedMinutes };
}

export type WeekTotals = {
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
};

export function weekTotals(entries: ComputedTimeEntry[], now: Date = new Date()): WeekTotals {
  const workedMinutes = entries.reduce(
    (acc, e) => acc + entryTotals(e, now).workedMinutes,
    0,
  );
  if (workedMinutes <= REGULAR_WEEK_MINUTES) {
    return { workedMinutes, regularMinutes: workedMinutes, overtimeMinutes: 0 };
  }
  return {
    workedMinutes,
    regularMinutes: REGULAR_WEEK_MINUTES,
    overtimeMinutes: workedMinutes - REGULAR_WEEK_MINUTES,
  };
}

// CSV export — one row per TimeEntry. Excludes still-open entries.
export type CsvEntry = ComputedTimeEntry & {
  user: { name: string | null; email: string };
  team: { name: string };
};

export function entriesToCsv(entries: CsvEntry[]): string {
  const header = [
    'employee_name',
    'employee_email',
    'team',
    'date',
    'clock_in',
    'clock_out',
    'worked_hours',
    'unpaid_break_hours',
    'approved',
  ];
  const rows: string[] = [header.join(',')];

  for (const e of entries) {
    if (!e.clockedOut) continue;
    const t = entryTotals(e);
    rows.push(
      [
        csvField(e.user.name ?? ''),
        csvField(e.user.email),
        csvField(e.team.name),
        e.clockedIn.toISOString().slice(0, 10),
        e.clockedIn.toISOString(),
        e.clockedOut.toISOString(),
        (t.workedMinutes / 60).toFixed(2),
        (t.unpaidBreakMinutes / 60).toFixed(2),
        (e as { approved?: boolean }).approved ? 'true' : 'false',
      ].join(','),
    );
  }

  return rows.join('\n');
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
