import { describe, expect, it } from 'vitest';
import { entryTotals, weekTotals, entriesToCsv } from '@/lib/payroll';
import { distanceMeters, withinFence } from '@/lib/geofence';

const baseEntry = (start: string, end: string | null) => ({
  id: 'e',
  userId: 'u',
  teamId: 't',
  clockedIn: new Date(start),
  clockedOut: end ? new Date(end) : null,
  breaks: [],
});

describe('entryTotals', () => {
  it('subtracts unpaid breaks from worked time', () => {
    const t = entryTotals({
      ...baseEntry('2026-05-16T09:00:00Z', '2026-05-16T17:00:00Z'),
      breaks: [
        {
          startedAt: new Date('2026-05-16T12:00:00Z'),
          endedAt: new Date('2026-05-16T12:30:00Z'),
          paid: false,
        },
      ],
    });
    expect(t.workedMinutes).toBe(8 * 60 - 30);
  });

  it('counts paid breaks as worked time', () => {
    const t = entryTotals({
      ...baseEntry('2026-05-16T09:00:00Z', '2026-05-16T17:00:00Z'),
      breaks: [
        {
          startedAt: new Date('2026-05-16T12:00:00Z'),
          endedAt: new Date('2026-05-16T12:30:00Z'),
          paid: true,
        },
      ],
    });
    expect(t.workedMinutes).toBe(8 * 60);
  });
});

describe('weekTotals', () => {
  it('splits regular vs overtime at 40h', () => {
    const longEntry = baseEntry('2026-05-16T00:00:00Z', '2026-05-18T18:00:00Z');
    const totals = weekTotals([longEntry]);
    expect(totals.workedMinutes).toBe(66 * 60);
    expect(totals.regularMinutes).toBe(40 * 60);
    expect(totals.overtimeMinutes).toBe(26 * 60);
  });

  it('returns zero overtime under 40h', () => {
    const e = baseEntry('2026-05-16T09:00:00Z', '2026-05-16T17:00:00Z');
    const totals = weekTotals([e]);
    expect(totals.overtimeMinutes).toBe(0);
  });
});

describe('entriesToCsv', () => {
  it('emits a header row + one line per completed entry', () => {
    const csv = entriesToCsv([
      {
        ...baseEntry('2026-05-16T09:00:00Z', '2026-05-16T17:00:00Z'),
        user: { name: 'Alex K', email: 'alex@example.com' },
        team: { name: 'Kitchen' },
      },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.startsWith('employee_name,employee_email')).toBe(true);
  });

  it('skips still-open entries', () => {
    const csv = entriesToCsv([
      {
        ...baseEntry('2026-05-16T09:00:00Z', null),
        user: { name: 'Alex', email: 'a@x.com' },
        team: { name: 'Kitchen' },
      },
    ]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});

describe('geofence', () => {
  it('returns zero distance for identical points', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });

  it('flags points outside the fence', () => {
    // ~111km between (0,0) and (0,1)
    const result = withinFence({ lat: 0, lng: 0 }, 1000, { lat: 0, lng: 1 });
    expect(result.inside).toBe(false);
    expect(result.distance).toBeGreaterThan(100_000);
  });

  it('admits points inside the fence', () => {
    // (0, 0) vs (0.0001, 0) ≈ 11 meters
    const result = withinFence({ lat: 0, lng: 0 }, 100, { lat: 0.0001, lng: 0 });
    expect(result.inside).toBe(true);
  });
});
