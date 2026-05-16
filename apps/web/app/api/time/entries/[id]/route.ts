import { z } from 'zod';
import { prisma, notify } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, json, ok } from '@/lib/api';

const Patch = z
  .object({
    clockedIn: z.string().datetime().optional(),
    clockedOut: z.string().datetime().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    approved: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.clockedIn == null ||
      v.clockedOut == null ||
      new Date(v.clockedIn) < new Date(v.clockedOut),
    { message: 'clockedIn must be before clockedOut', path: ['clockedOut'] },
  );

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const existing = await prisma.timeEntry.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true, userId: true, approved: true },
  });
  if (!existing) return json(err('not_found', 'Time entry not found.'), { status: 404 });

  if (!canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t edit this entry.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.clockedIn) data.clockedIn = new Date(parsed.data.clockedIn);
  if (parsed.data.clockedOut !== undefined) {
    data.clockedOut = parsed.data.clockedOut ? new Date(parsed.data.clockedOut) : null;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.approved !== undefined) {
    data.approved = parsed.data.approved;
    data.approvedBy = parsed.data.approved ? ctx.userId : null;
    data.approvedAt = parsed.data.approved ? new Date() : null;
  }

  const updated = await prisma.timeEntry.update({
    where: { id: params.id },
    data,
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action:
      parsed.data.approved === true
        ? 'timesheet.approved'
        : parsed.data.approved === false
          ? 'timesheet.unapproved'
          : 'time_entry.edited',
    entity: 'TimeEntry',
    entityId: updated.id,
    metadata: { targetUserId: existing.userId },
  });

  if (parsed.data.approved && existing.userId !== ctx.userId) {
    await notify({
      orgId: ctx.orgId,
      userId: existing.userId,
      kind: 'timesheet.approved',
      title: 'Your timesheet was approved',
      body: null,
      url: '/app/time',
    });
  }

  return json(ok(updated));
}
