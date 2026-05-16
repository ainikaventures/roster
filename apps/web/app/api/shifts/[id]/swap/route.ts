import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// POST /api/shifts/:id/swap — the assignee asks to be swapped off this shift.
// Body: { recipientId?, reason? }
//
// If recipientId is set, status starts as PENDING_RECIPIENT and that teammate
// must accept before the manager reviews. Without a recipient, the request
// goes straight to PENDING_MANAGER as an "open call for coverage".
const Body = z.object({
  recipientId: z.string().min(1).nullable().optional(),
  reason: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const shift = await prisma.shift.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, userId: true, teamId: true, startsAt: true, endsAt: true },
  });
  if (!shift) return json(err('not_found', 'Shift not found.'), { status: 404 });
  if (shift.userId !== ctx.userId) {
    return json(err('forbidden', 'You can only swap a shift assigned to you.'), {
      status: 403,
    });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  if (parsed.data.recipientId) {
    if (parsed.data.recipientId === ctx.userId) {
      return json(err('invalid_input', 'Pick a different teammate.'), { status: 400 });
    }
    const member = await prisma.membership.findFirst({
      where: {
        userId: parsed.data.recipientId,
        orgId: ctx.orgId,
        OR: [{ teamId: shift.teamId }, { role: { not: 'EMPLOYEE' } }],
      },
      select: { id: true },
    });
    if (!member) {
      return json(err('invalid_input', 'That teammate isn’t on this team.'), { status: 400 });
    }
  }

  const swap = await prisma.shiftSwapRequest.create({
    data: {
      orgId: ctx.orgId,
      shiftId: shift.id,
      requesterId: ctx.userId,
      recipientId: parsed.data.recipientId ?? null,
      reason: parsed.data.reason ?? null,
      status: parsed.data.recipientId ? 'PENDING_RECIPIENT' : 'PENDING_MANAGER',
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift.swap_requested',
    entity: 'ShiftSwapRequest',
    entityId: swap.id,
    metadata: { shiftId: shift.id, recipientId: parsed.data.recipientId },
  });

  // Notify the recipient (or all managers if open).
  if (parsed.data.recipientId) {
    await notify({
      orgId: ctx.orgId,
      userId: parsed.data.recipientId,
      kind: 'system',
      title: 'Swap request',
      body: 'A teammate is asking you to cover a shift.',
      url: '/app/schedule/swaps',
    });
  } else {
    const managers = await prisma.managerAssignment.findMany({
      where: {
        OR: [
          { teamId: shift.teamId },
          { branch: { teams: { some: { id: shift.teamId } } } },
        ],
      },
      select: { userId: true },
    });
    for (const m of new Set(managers.map((m) => m.userId))) {
      if (m === ctx.userId) continue;
      await notify({
        orgId: ctx.orgId,
        userId: m,
        kind: 'system',
        title: 'Coverage requested',
        url: '/app/schedule/swaps',
      });
    }
  }

  return json(ok(swap), { status: 201 });
}
