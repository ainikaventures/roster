import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// POST /api/time/breaks   — start a break on the current open entry
// DELETE /api/time/breaks — end the most-recent open break
// ---------------------------------------------------------------------------

const StartBody = z.object({ paid: z.boolean().optional() });

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = StartBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  const open = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    select: { id: true, breaks: { where: { endedAt: null }, select: { id: true } } },
  });
  if (!open) return json(err('not_clocked_in', 'Clock in first.'), { status: 409 });
  if (open.breaks.length > 0) {
    return json(err('break_active', 'You already have an open break.'), { status: 409 });
  }

  const brk = await prisma.break.create({
    data: {
      timeEntryId: open.id,
      startedAt: new Date(),
      paid: parsed.data.paid ?? false,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time.break_started',
    entity: 'Break',
    entityId: brk.id,
    metadata: { timeEntryId: open.id, paid: brk.paid },
  });

  return json(ok(brk));
}

export async function DELETE() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const open = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    select: {
      breaks: {
        where: { endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      },
    },
  });

  const openBreak = open?.breaks[0];
  if (!openBreak) {
    return json(err('no_open_break', 'No open break to end.'), { status: 409 });
  }

  const ended = await prisma.break.update({
    where: { id: openBreak.id },
    data: { endedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time.break_ended',
    entity: 'Break',
    entityId: ended.id,
  });

  return json(ok(ended));
}
