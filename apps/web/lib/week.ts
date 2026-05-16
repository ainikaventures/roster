import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';

// ISO-style week (Monday → Sunday). Adjusts to org tz later — Phase 1 uses local.

export type WeekRange = {
  start: Date;
  end: Date;
  days: Date[];
  label: string;
};

export function weekFor(date: Date): WeekRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return {
    start,
    end,
    days,
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
  };
}

export function isToday(d: Date) {
  return isSameDay(d, new Date());
}

export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function fmtTime(d: Date | string) {
  return format(typeof d === 'string' ? new Date(d) : d, 'h:mm a');
}

export function durationMinutes(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60_000));
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
