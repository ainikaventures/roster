// ---------------------------------------------------------------------------
// Greedy auto-scheduler.
//
// Phase 8 ships a deterministic, transparent assignment algorithm. Full
// optimization-based scheduling (ILP / constraint solver) is a future
// upgrade; this one is good enough for "fill open shifts from available
// employees without overlap" — which is the spec's stated goal.
//
// Rules, in priority order:
//   1. Employee must be available for the shift window (no UNAVAILABLE
//      Availability row overlaps it).
//   2. Employee must not already have an overlapping shift.
//   3. Prefer employees with a PREFERRED availability window covering
//      the shift over plain AVAILABLE.
//   4. Among ties, prefer the employee with the fewest assigned shifts
//      in the same week (load balancing).
// ---------------------------------------------------------------------------

export type OpenShift = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export type Candidate = {
  userId: string;
  /// Availability windows the candidate has for this shift's day-of-week.
  windows: {
    startMinutes: number;
    endMinutes: number;
    kind: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
  }[];
  /// Existing assigned shifts in the same week.
  existing: { startsAt: Date; endsAt: Date }[];
};

export type Assignment = { shiftId: string; userId: string };

function shiftWindow(shift: OpenShift) {
  const start = shift.startsAt;
  const end = shift.endsAt;
  return {
    dayOfWeek: start.getDay(),
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: end.getHours() * 60 + end.getMinutes(),
  };
}

function windowCovers(
  candidate: { startMinutes: number; endMinutes: number },
  shift: { startMinutes: number; endMinutes: number },
) {
  return candidate.startMinutes <= shift.startMinutes && candidate.endMinutes >= shift.endMinutes;
}

function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

export function autoAssign(
  shifts: OpenShift[],
  candidates: Candidate[],
): Assignment[] {
  // Snapshot the candidate roster — we mutate `existing` as we assign.
  const roster = candidates.map((c) => ({
    ...c,
    existing: [...c.existing],
  }));

  const assignments: Assignment[] = [];

  for (const shift of shifts) {
    const sw = shiftWindow(shift);
    const ranked = roster
      .map((c) => {
        // Pull out windows on this day of week.
        const dayWindows = c.windows;

        const hasBlock = dayWindows.some(
          (w) =>
            w.kind === 'UNAVAILABLE' &&
            w.startMinutes < sw.endMinutes &&
            w.endMinutes > sw.startMinutes,
        );
        if (hasBlock) return null;

        const overlapping = c.existing.some((s) => overlaps(s, shift));
        if (overlapping) return null;

        const preferred = dayWindows.some(
          (w) => w.kind === 'PREFERRED' && windowCovers(w, sw),
        );
        const available =
          preferred ||
          dayWindows.some((w) => w.kind === 'AVAILABLE' && windowCovers(w, sw)) ||
          // If the candidate has no availability set for that day, treat as available.
          dayWindows.length === 0;

        if (!available) return null;

        return {
          candidate: c,
          score: preferred ? 0 : 1,
          load: c.existing.length,
        };
      })
      .filter((x): x is { candidate: Candidate; score: number; load: number } => x !== null)
      .sort((a, b) => a.score - b.score || a.load - b.load);

    const winner = ranked[0];
    if (!winner) continue;
    assignments.push({ shiftId: shift.id, userId: winner.candidate.userId });
    winner.candidate.existing.push({
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    });
  }

  return assignments;
}
