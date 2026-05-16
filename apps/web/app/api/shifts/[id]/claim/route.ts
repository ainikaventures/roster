import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// POST /api/shifts/:id/claim — employee claims an open published shift.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const shift = await prisma.shift.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      teamId: true,
      isOpen: true,
      published: true,
      userId: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!shift) return json(err('not_found', 'Shift not found.'), { status: 404 });
  if (!shift.published) {
    return json(err('not_open', 'That shift isn’t open for claiming.'), { status: 409 });
  }
  if (!shift.isOpen || shift.userId != null) {
    return json(err('not_open', 'Already claimed.'), { status: 409 });
  }

  // User must have scope access to the shift's team.
  if (ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(shift.teamId)) {
    return json(err('forbidden', 'You can’t claim a shift in that team.'), { status: 403 });
  }

  // Prevent overlap with another shift the user already has.
  const conflict = await prisma.shift.findFirst({
    where: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      startsAt: { lt: shift.endsAt },
      endsAt: { gt: shift.startsAt },
      NOT: { id: shift.id },
    },
    select: { id: true },
  });
  if (conflict) {
    return json(err('conflict', 'You already have an overlapping shift.'), { status: 409 });
  }

  const claimed = await prisma.shift.update({
    where: { id: shift.id },
    data: { userId: ctx.userId, isOpen: false },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift.claimed',
    entity: 'Shift',
    entityId: shift.id,
  });

  // Notify managers of that team that the open shift was filled.
  const managers = await prisma.managerAssignment.findMany({
    where: { OR: [{ teamId: shift.teamId }, { branch: { teams: { some: { id: shift.teamId } } } }] },
    select: { userId: true },
  });
  for (const m of new Set(managers.map((m) => m.userId))) {
    if (m === ctx.userId) continue;
    await notify({
      orgId: ctx.orgId,
      userId: m,
      kind: 'system',
      title: 'Open shift claimed',
      url: '/app/schedule',
    });
  }

  return json(ok(claimed));
}
