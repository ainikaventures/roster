import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// POST /api/time/clock-out
// Closes the user's open entry and auto-ends any open break.
// ---------------------------------------------------------------------------

export async function POST() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const open = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    select: { id: true, breaks: { where: { endedAt: null }, select: { id: true } } },
  });

  if (!open) {
    return json(err('not_clocked_in', 'You aren’t clocked in.'), { status: 409 });
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    if (open.breaks.length > 0) {
      await tx.break.updateMany({
        where: { id: { in: open.breaks.map((b) => b.id) } },
        data: { endedAt: now },
      });
    }
    return tx.timeEntry.update({
      where: { id: open.id },
      data: { clockedOut: now },
    });
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time.clocked_out',
    entity: 'TimeEntry',
    entityId: updated.id,
  });

  return json(ok(updated));
}
