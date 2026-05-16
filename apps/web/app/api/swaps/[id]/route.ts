import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// PATCH /api/swaps/:id
//   { action: "accept" }      — recipient accepts → moves to PENDING_MANAGER
//   { action: "decline" }     — recipient declines → DENIED
//   { action: "approve" }     — manager final-approves → APPROVED, shift reassigned
//   { action: "deny", notes } — manager denies → DENIED
//   { action: "cancel" }      — requester cancels → CANCELED
const Body = z.object({
  action: z.enum(['accept', 'decline', 'approve', 'deny', 'cancel']),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      shiftId: true,
      requesterId: true,
      recipientId: true,
      status: true,
      shift: {
        select: { id: true, teamId: true, userId: true },
      },
    },
  });
  if (!swap) return json(err('not_found', 'Swap not found.'), { status: 404 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  const action = parsed.data.action;

  // Authorization.
  const isRecipient = swap.recipientId === ctx.userId;
  const isRequester = swap.requesterId === ctx.userId;
  const isMgr = isManager(ctx.scope.role);

  switch (action) {
    case 'accept':
    case 'decline':
      if (!isRecipient) {
        return json(err('forbidden', 'Only the recipient can accept / decline.'), {
          status: 403,
        });
      }
      if (swap.status !== 'PENDING_RECIPIENT') {
        return json(err('invalid_state', 'Already handled.'), { status: 409 });
      }
      break;
    case 'approve':
    case 'deny':
      if (!isMgr) return json(err('forbidden', 'Managers only.'), { status: 403 });
      if (swap.status !== 'PENDING_MANAGER') {
        return json(err('invalid_state', 'Not awaiting manager review.'), { status: 409 });
      }
      break;
    case 'cancel':
      if (!isRequester) {
        return json(err('forbidden', 'Only the requester can cancel.'), { status: 403 });
      }
      if (['APPROVED', 'DENIED', 'CANCELED'].includes(swap.status)) {
        return json(err('invalid_state', 'Already decided.'), { status: 409 });
      }
      break;
  }

  // State + side-effect transitions.
  let nextStatus = swap.status;
  let reassignTo: string | null | undefined = undefined;

  if (action === 'accept') nextStatus = 'PENDING_MANAGER';
  if (action === 'decline') nextStatus = 'DENIED';
  if (action === 'approve') {
    nextStatus = 'APPROVED';
    reassignTo = swap.recipientId ?? null; // null = becomes open
  }
  if (action === 'deny') nextStatus = 'DENIED';
  if (action === 'cancel') nextStatus = 'CANCELED';

  const result = await prisma.$transaction(async (tx) => {
    const u = await tx.shiftSwapRequest.update({
      where: { id: swap.id },
      data: {
        status: nextStatus,
        reviewerId: ['approve', 'deny'].includes(action) ? ctx.userId : undefined,
        reviewedAt: ['approve', 'deny'].includes(action) ? new Date() : undefined,
        reviewNotes: parsed.data.notes ?? undefined,
      },
    });
    if (reassignTo !== undefined) {
      await tx.shift.update({
        where: { id: swap.shiftId },
        data: {
          userId: reassignTo,
          isOpen: reassignTo == null,
        },
      });
    }
    return u;
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: `shift.swap_${action}`,
    entity: 'ShiftSwapRequest',
    entityId: swap.id,
  });

  // Outbound notifications.
  if (action === 'accept') {
    // Tell the requester + the team's managers it's now awaiting approval.
    await notify({
      orgId: ctx.orgId,
      userId: swap.requesterId,
      kind: 'system',
      title: 'Coverage accepted — awaiting manager approval',
      url: '/app/schedule/swaps',
    });
  } else if (action === 'approve' || action === 'deny') {
    if (swap.requesterId !== ctx.userId) {
      await notify({
        orgId: ctx.orgId,
        userId: swap.requesterId,
        kind: 'system',
        title:
          action === 'approve'
            ? 'Swap approved'
            : 'Swap denied',
        body: parsed.data.notes ?? null,
        url: '/app/schedule/swaps',
      });
    }
    if (swap.recipientId && swap.recipientId !== ctx.userId) {
      await notify({
        orgId: ctx.orgId,
        userId: swap.recipientId,
        kind: 'system',
        title:
          action === 'approve'
            ? 'You picked up a shift'
            : 'Swap denied',
        url: '/app/schedule',
      });
    }
  }

  return json(ok(result));
}
