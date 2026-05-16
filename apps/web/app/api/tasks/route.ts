import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/tasks?status=&teamId=&mine=
// Employees: see open tasks assigned to them + unassigned in their team.
// Managers: see everything in scope; can filter by team and assignee.
// ---------------------------------------------------------------------------

const Query = z.object({
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED'])
    .optional(),
  teamId: z.string().min(1).optional(),
  mine: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    teamId: url.searchParams.get('teamId') ?? undefined,
    mine: url.searchParams.get('mine') ?? undefined,
  });
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const teamFilter =
    ctx.scope.teamIds === null
      ? { team: { branch: { orgId: ctx.orgId } } }
      : { teamId: { in: ctx.scope.teamIds } };

  const tasks = await prisma.task.findMany({
    where: {
      orgId: ctx.orgId,
      ...teamFilter,
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.mine || !isManager(ctx.scope.role)
        ? {
            OR: [{ assignedUserId: ctx.userId }, { assignedUserId: null }],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      recurrence: true,
      requirePhoto: true,
      requireSignature: true,
      requireNote: true,
      teamId: true,
      assignedUserId: true,
      createdAt: true,
      team: { select: { id: true, name: true, color: true } },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      _count: { select: { completions: true } },
      completions: {
        // For recurring tasks the UI shows "last completed".
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: { id: true, completedAt: true, userId: true },
      },
    },
  });

  return json(ok(tasks));
}

// ---------------------------------------------------------------------------
// POST /api/tasks — managers create
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  teamId: z.string().min(1),
  assignedUserId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(140),
  description: z.string().max(4000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueAt: z.string().datetime().nullable().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
  requirePhoto: z.boolean().default(false),
  requireSignature: z.boolean().default(false),
  requireNote: z.boolean().default(false),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  if (!canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'You can’t create tasks for that team.'), { status: 403 });
  }

  // If assigning, verify membership.
  if (parsed.data.assignedUserId) {
    const member = await prisma.membership.findFirst({
      where: {
        userId: parsed.data.assignedUserId,
        orgId: ctx.orgId,
        OR: [{ teamId: parsed.data.teamId }, { role: { not: 'EMPLOYEE' } }],
      },
      select: { id: true },
    });
    if (!member) {
      return json(err('invalid_assignee', 'That user isn’t on this team.'), { status: 400 });
    }
  }

  const task = await prisma.task.create({
    data: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId,
      createdById: ctx.userId,
      assignedUserId: parsed.data.assignedUserId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      recurrence: parsed.data.recurrence,
      requirePhoto: parsed.data.requirePhoto,
      requireSignature: parsed.data.requireSignature,
      requireNote: parsed.data.requireNote,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'task.created',
    entity: 'Task',
    entityId: task.id,
    metadata: { teamId: task.teamId, recurrence: task.recurrence },
  });

  if (task.assignedUserId && task.assignedUserId !== ctx.userId) {
    await notify({
      orgId: ctx.orgId,
      userId: task.assignedUserId,
      kind: 'task.assigned',
      title: `New task: ${task.title}`,
      body: task.dueAt ? `Due ${task.dueAt.toISOString()}` : null,
      url: '/app/tasks',
    });
  }

  return json(ok(task), { status: 201 });
}
