import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, json, ok } from '@/lib/api';

const Patch = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().max(4000).nullable().optional(),
  assignedUserId: z.string().min(1).nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  requirePhoto: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  requireNote: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const existing = await prisma.task.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Task not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t edit that team’s tasks.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.assignedUserId !== undefined) data.assignedUserId = parsed.data.assignedUserId;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.dueAt !== undefined) {
    data.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  }
  if (parsed.data.recurrence !== undefined) data.recurrence = parsed.data.recurrence;
  if (parsed.data.requirePhoto !== undefined) data.requirePhoto = parsed.data.requirePhoto;
  if (parsed.data.requireSignature !== undefined) data.requireSignature = parsed.data.requireSignature;
  if (parsed.data.requireNote !== undefined) data.requireNote = parsed.data.requireNote;

  const updated = await prisma.task.update({ where: { id: params.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'task.updated',
    entity: 'Task',
    entityId: updated.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const existing = await prisma.task.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Task not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t delete that task.'), { status: 403 });
  }

  // Soft delete via ARCHIVED to preserve completion history; hard delete would
  // cascade and lose audit trail.
  await prisma.task.update({
    where: { id: params.id },
    data: { status: 'ARCHIVED', archivedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'task.archived',
    entity: 'Task',
    entityId: params.id,
  });

  return json(ok({ id: params.id }));
}
