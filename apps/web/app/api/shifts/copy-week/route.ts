import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// POST /api/shifts/copy-week
// Copies every shift in (teamId, fromWeekStart..fromWeekStart+7d) into the
// same offsets in (toWeekStart..toWeekStart+7d). Copies are saved as drafts
// (published=false) so the manager can review before publishing.
const Body = z.object({
  teamId: z.string().min(1),
  fromWeekStart: z.string().datetime(),
  toWeekStart: z.string().datetime(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }
  if (!canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const fromStart = new Date(parsed.data.fromWeekStart);
  const toStart = new Date(parsed.data.toWeekStart);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const fromEnd = new Date(fromStart.getTime() + weekMs);

  const source = await prisma.shift.findMany({
    where: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId,
      startsAt: { gte: fromStart, lt: fromEnd },
    },
    select: {
      teamId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      isOpen: true,
    },
  });

  const offsetMs = toStart.getTime() - fromStart.getTime();
  if (source.length === 0) {
    return json(ok({ copied: 0 }));
  }

  const created = await prisma.shift.createMany({
    data: source.map((s) => ({
      orgId: ctx.orgId,
      teamId: s.teamId,
      userId: s.userId,
      startsAt: new Date(s.startsAt.getTime() + offsetMs),
      endsAt: new Date(s.endsAt.getTime() + offsetMs),
      notes: s.notes,
      isOpen: s.isOpen,
      published: false,
    })),
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shifts.copied_week',
    entity: 'Team',
    entityId: parsed.data.teamId,
    metadata: {
      from: parsed.data.fromWeekStart,
      to: parsed.data.toWeekStart,
      count: created.count,
    },
  });

  return json(ok({ copied: created.count }));
}
