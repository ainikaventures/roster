import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// GET /api/jobs?status=&mine=
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as
    | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | null;
  const mine = url.searchParams.get('mine') === 'true';

  const where: Record<string, unknown> = {
    orgId: ctx.orgId,
    ...(status ? { status } : {}),
    ...(mine || !isManager(ctx.scope.role) ? { assignedUserId: ctx.userId } : {}),
  };
  if (ctx.scope.teamIds !== null) {
    where.OR = [{ teamId: { in: ctx.scope.teamIds } }, { teamId: null }];
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      address: true,
      lat: true,
      lng: true,
      startsAt: true,
      endsAt: true,
      status: true,
      teamId: true,
      assignedUserId: true,
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });

  return json(ok(jobs));
}

const Body = z
  .object({
    teamId: z.string().min(1).nullable().optional(),
    assignedUserId: z.string().min(1).nullable().optional(),
    title: z.string().trim().min(1).max(140),
    description: z.string().max(2000).optional(),
    address: z.string().max(500).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((v) => new Date(v.startsAt) < new Date(v.endsAt), {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
  });

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }
  if (parsed.data.teamId && !canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const job = await prisma.job.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      teamId: parsed.data.teamId ?? null,
      assignedUserId: parsed.data.assignedUserId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      address: parsed.data.address ?? null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    },
  });

  if (job.assignedUserId && job.assignedUserId !== ctx.userId) {
    await notify({
      orgId: ctx.orgId,
      userId: job.assignedUserId,
      kind: 'system',
      title: `New job: ${job.title}`,
      body: job.address ?? null,
      url: '/app/jobs',
    });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'job.created',
    entity: 'Job',
    entityId: job.id,
  });

  return json(ok(job), { status: 201 });
}
