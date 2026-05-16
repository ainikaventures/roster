import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, json, ok } from '@/lib/api';

const PatchBody = z
  .object({
    userId: z.string().min(1).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    notes: z.string().max(500).nullable().optional(),
    published: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.startsAt == null ||
      v.endsAt == null ||
      new Date(v.startsAt) < new Date(v.endsAt),
    { message: 'startsAt must be before endsAt', path: ['endsAt'] },
  );

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const existing = await prisma.shift.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Shift not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t edit that team’s schedule.'), { status: 403 });
  }

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.userId !== undefined) data.userId = parsed.data.userId;
  if (parsed.data.startsAt) data.startsAt = new Date(parsed.data.startsAt);
  if (parsed.data.endsAt) data.endsAt = new Date(parsed.data.endsAt);
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.published !== undefined) data.published = parsed.data.published;

  const updated = await prisma.shift.update({
    where: { id: params.id },
    data,
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift.updated',
    entity: 'Shift',
    entityId: updated.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const existing = await prisma.shift.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Shift not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t edit that team’s schedule.'), { status: 403 });
  }

  await prisma.shift.delete({ where: { id: params.id } });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift.deleted',
    entity: 'Shift',
    entityId: params.id,
  });

  return json(ok({ id: params.id }));
}
