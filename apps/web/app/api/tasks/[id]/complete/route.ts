import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

const Body = z.object({
  notes: z.string().max(2000).optional(),
  /** Base64 / future signed-URL refs for required evidence. */
  photoData: z.string().max(2_000_000).optional(),
  signatureData: z.string().max(500_000).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/complete
//
// Records a completion. For one-off tasks, transitions status to DONE.
// For recurring tasks, status stays OPEN and a new TaskCompletion row is
// created each time.
// ---------------------------------------------------------------------------

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const task = await prisma.task.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      title: true,
      teamId: true,
      status: true,
      recurrence: true,
      assignedUserId: true,
      createdById: true,
      requirePhoto: true,
      requireSignature: true,
      requireNote: true,
    },
  });
  if (!task || task.status === 'ARCHIVED') {
    return json(err('not_found', 'Task not found.'), { status: 404 });
  }

  // The completer must have scope access to the task's team.
  if (ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(task.teamId)) {
    return json(err('forbidden', 'You can’t complete that task.'), { status: 403 });
  }
  // If assigned, only the assignee (or a manager) can complete.
  if (task.assignedUserId && task.assignedUserId !== ctx.userId && ctx.scope.role === 'EMPLOYEE') {
    return json(err('forbidden', 'Only the assignee can complete that task.'), {
      status: 403,
    });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Enforce required evidence.
  const errors: string[] = [];
  if (task.requireNote && !parsed.data.notes?.trim()) errors.push('Notes required');
  if (task.requirePhoto && !parsed.data.photoData) errors.push('Photo required');
  if (task.requireSignature && !parsed.data.signatureData) errors.push('Signature required');
  if (errors.length > 0) {
    return json(err('invalid_input', errors.join('; ')), { status: 400 });
  }

  const evidence: Record<string, unknown> | undefined =
    parsed.data.photoData || parsed.data.signatureData
      ? {
          ...(parsed.data.photoData ? { photo: parsed.data.photoData } : {}),
          ...(parsed.data.signatureData ? { signature: parsed.data.signatureData } : {}),
        }
      : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.taskCompletion.create({
      data: {
        taskId: task.id,
        userId: ctx.userId,
        notes: parsed.data.notes ?? null,
        evidence: evidence as never,
      },
    });
    if (task.recurrence === 'NONE') {
      await tx.task.update({
        where: { id: task.id },
        data: { status: 'DONE' },
      });
    }
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'task.completed',
    entity: 'Task',
    entityId: task.id,
    metadata: { recurrence: task.recurrence },
  });

  // Let the creator know if they didn't complete it themselves.
  if (task.createdById !== ctx.userId) {
    await notify({
      orgId: ctx.orgId,
      userId: task.createdById,
      kind: 'system',
      title: `Task completed: ${task.title}`,
      url: '/app/tasks',
    });
  }

  return json(ok({ taskId: task.id }));
}
