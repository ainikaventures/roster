import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

const Patch = z
  .object({
    status: z.enum(['APPROVED', 'DENIED', 'CANCELED']),
    reviewNotes: z.string().max(2000).optional(),
  })
  .strict();

// PATCH /api/time-off/:id — approve / deny (managers) or cancel (requester).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const request = await prisma.timeOffRequest.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      userId: true,
      status: true,
      hours: true,
      type: true,
    },
  });
  if (!request) return json(err('not_found', 'Request not found.'), { status: 404 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Authorization:
  // - CANCELED: requester only, and only while still PENDING.
  // - APPROVED / DENIED: managers only.
  if (parsed.data.status === 'CANCELED') {
    if (request.userId !== ctx.userId) {
      return json(err('forbidden', 'Only the requester can cancel.'), { status: 403 });
    }
    if (request.status !== 'PENDING') {
      return json(err('invalid_state', 'Can only cancel pending requests.'), { status: 409 });
    }
  } else {
    if (!isManager(ctx.scope.role)) {
      return json(err('forbidden', 'Only managers can approve / deny.'), { status: 403 });
    }
    if (request.userId === ctx.userId) {
      return json(err('forbidden', 'You can’t approve your own request.'), { status: 403 });
    }
    if (request.status !== 'PENDING') {
      return json(err('invalid_state', 'Already decided.'), { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.timeOffRequest.update({
      where: { id: request.id },
      data: {
        status: parsed.data.status,
        reviewerId: parsed.data.status === 'CANCELED' ? null : ctx.userId,
        reviewedAt: parsed.data.status === 'CANCELED' ? null : new Date(),
        reviewNotes: parsed.data.reviewNotes ?? null,
      },
    });

    // On approval, deduct hours from the requester's PTO balance (only for
    // VACATION / PERSONAL / SICK — UNPAID and OTHER never debit).
    const deductible = (['VACATION', 'PERSONAL', 'SICK'] as const).includes(request.type as never);
    if (parsed.data.status === 'APPROVED' && deductible) {
      const minutes = request.hours * 60;
      await tx.ptoBalance.upsert({
        where: { userId: request.userId },
        update: { balanceMinutes: { decrement: minutes } },
        create: {
          orgId: ctx.orgId,
          userId: request.userId,
          balanceMinutes: -minutes,
        },
      });
    }

    return u;
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: `time_off.${parsed.data.status.toLowerCase()}`,
    entity: 'TimeOffRequest',
    entityId: request.id,
    metadata: { targetUserId: request.userId, hours: request.hours },
  });

  if (request.userId !== ctx.userId && parsed.data.status !== 'CANCELED') {
    await notify({
      orgId: ctx.orgId,
      userId: request.userId,
      kind: 'system',
      title:
        parsed.data.status === 'APPROVED'
          ? 'Your time-off request was approved'
          : 'Your time-off request was denied',
      body: parsed.data.reviewNotes ?? null,
      url: '/app/hr/time-off',
    });
  }

  return json(ok(updated));
}
