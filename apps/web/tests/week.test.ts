import { describe, expect, it } from 'vitest';
import { durationMinutes, fmtDuration, weekFor } from '@/lib/week';

describe('weekFor', () => {
  it('returns 7 consecutive days starting on Monday', () => {
    // Wed 2026-05-13
    const week = weekFor(new Date('2026-05-13T12:00:00Z'));
    expect(week.days).toHaveLength(7);
    expect(week.days[0].getDay()).toBe(1); // Monday
    expect(week.days[6].getDay()).toBe(0); // Sunday
  });
});

describe('fmtDuration', () => {
  it('formats minutes', () => {
    expect(fmtDuration(0)).toBe('0m');
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(60)).toBe('1h');
    expect(fmtDuration(125)).toBe('2h 5m');
  });
});

describe('durationMinutes', () => {
  it('computes whole-minute durations', () => {
    expect(
      durationMinutes('2026-05-16T09:00:00Z', '2026-05-16T17:30:00Z'),
    ).toBe(8 * 60 + 30);
  });
  it('clamps negative durations to zero', () => {
    expect(
      durationMinutes('2026-05-16T17:00:00Z', '2026-05-16T09:00:00Z'),
    ).toBe(0);
  });
});
