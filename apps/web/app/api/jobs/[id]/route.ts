import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

const Patch = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']).optional(),
  completionNotes: z.string().max(2000).nullable().optional(),
  assignedUserId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const job = await prisma.job.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true, assignedUserId: true, status: true },
  });
  if (!job) return json(err('not_found', 'Job not found.'), { status: 404 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  // Authorization:
  // - Assignee can flip status SCHEDULED → IN_PROGRESS → COMPLETED.
  // - Managers can do anything (reassign, cancel, etc).
  if (!isManager(ctx.scope.role)) {
    if (job.assignedUserId !== ctx.userId) {
      return json(err('forbidden', 'Not yours.'), { status: 403 });
    }
    if (parsed.data.status === 'CANCELED' || parsed.data.assignedUserId !== undefined) {
      return json(err('forbidden', 'Managers only for that change.'), { status: 403 });
    }
  } else if (job.teamId && !canWriteToTeam(ctx.scope, job.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    if (parsed.data.status === 'COMPLETED') data.completedAt = new Date();
  }
  if (parsed.data.completionNotes !== undefined) data.completionNotes = parsed.data.completionNotes;
  if (parsed.data.assignedUserId !== undefined) data.assignedUserId = parsed.data.assignedUserId;

  const updated = await prisma.job.update({ where: { id: job.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: `job.${parsed.data.status ? parsed.data.status.toLowerCase() : 'updated'}`,
    entity: 'Job',
    entityId: job.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}
