import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { autoAssign, type Candidate, type OpenShift } from '@/lib/auto-scheduler';

// POST /api/shifts/auto-assign
// Finds open shifts in the requested week for the team and assigns them
// to available employees using the greedy algorithm. Dry-run by default so
// managers can preview the result before committing.
const Body = z.object({
  teamId: z.string().min(1),
  weekStart: z.string().datetime(),
  commit: z.boolean().default(false),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  if (!canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const start = new Date(parsed.data.weekStart);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openShifts, employees] = await Promise.all([
    prisma.shift.findMany({
      where: {
        orgId: ctx.orgId,
        teamId: parsed.data.teamId,
        userId: null,
        startsAt: { gte: start, lt: end },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.orgId, teamId: parsed.data.teamId, role: 'EMPLOYEE' },
      select: {
        userId: true,
        user: {
          select: {
            availabilities: {
              where: { orgId: ctx.orgId },
              select: {
                dayOfWeek: true,
                startMinutes: true,
                endMinutes: true,
                kind: true,
              },
            },
            shifts: {
              where: {
                orgId: ctx.orgId,
                startsAt: { gte: start, lt: end },
              },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    }),
  ]);

  const shifts: OpenShift[] = openShifts.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
  }));

  // Build candidates with day-of-week filtered availability for each shift's day.
  // We need per-shift windows since dayOfWeek varies — easier to pre-bucket.
  const baseCandidates: Candidate[] = employees.map((m) => ({
    userId: m.userId,
    windows: m.user.availabilities as Candidate['windows'],
    existing: m.user.shifts.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
  }));

  // The scheduler treats `windows` as already filtered to the right day. We
  // run one pass per dayOfWeek to honor that contract, then merge.
  const allAssignments: { shiftId: string; userId: string }[] = [];
  const shiftsByDow = new Map<number, OpenShift[]>();
  for (const s of shifts) {
    const dow = s.startsAt.getDay();
    if (!shiftsByDow.has(dow)) shiftsByDow.set(dow, []);
    shiftsByDow.get(dow)!.push(s);
  }
  // Track running load per candidate across days.
  const runningExisting = new Map(
    baseCandidates.map((c) => [c.userId, [...c.existing]]),
  );
  for (const [dow, daysShifts] of shiftsByDow) {
    const dayCandidates: Candidate[] = baseCandidates.map((c) => ({
      ...c,
      windows: c.windows.filter((w) => (w as { dayOfWeek?: number }).dayOfWeek === dow),
      existing: runningExisting.get(c.userId) ?? [],
    }));
    const result = autoAssign(daysShifts, dayCandidates);
    for (const a of result) {
      allAssignments.push(a);
      const shift = daysShifts.find((s) => s.id === a.shiftId)!;
      runningExisting.get(a.userId)!.push({
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      });
    }
  }

  if (parsed.data.commit) {
    await prisma.$transaction(
      allAssignments.map((a) =>
        prisma.shift.update({
          where: { id: a.shiftId },
          data: { userId: a.userId, isOpen: false },
        }),
      ),
    );
    await audit({
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: 'shifts.auto_assigned',
      entity: 'Team',
      entityId: parsed.data.teamId,
      metadata: { count: allAssignments.length, weekStart: parsed.data.weekStart },
    });
  }

  return json(
    ok({
      assigned: allAssignments,
      total: shifts.length,
      unassigned: shifts.length - allAssignments.length,
      committed: parsed.data.commit,
    }),
  );
}
