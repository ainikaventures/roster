import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/shifts?from=<iso>&to=<iso>&teamId=<optional>
// Returns shifts within range that are visible to the current scope.
// Employees only see published shifts. Managers see drafts too.
// ---------------------------------------------------------------------------

const ListQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  teamId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = ListQuery.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    teamId: url.searchParams.get('teamId') ?? undefined,
  });
  if (!parsed.success) {
    return json(err('invalid_input', 'Missing or invalid from/to'), { status: 400 });
  }

  const teamFilter =
    ctx.scope.teamIds === null
      ? { team: { branch: { orgId: ctx.orgId } } }
      : { teamId: { in: ctx.scope.teamIds } };

  const shifts = await prisma.shift.findMany({
    where: {
      orgId: ctx.orgId,
      ...teamFilter,
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : {}),
      startsAt: { gte: new Date(parsed.data.from) },
      endsAt: { lte: new Date(parsed.data.to) },
      ...(isManager(ctx.scope.role) ? {} : { published: true }),
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      teamId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      published: true,
      team: { select: { name: true, color: true, branchId: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return json(ok(shifts));
}

// ---------------------------------------------------------------------------
// POST /api/shifts — create a shift (manager+)
// ---------------------------------------------------------------------------

const CreateBody = z
  .object({
    teamId: z.string().min(1),
    userId: z.string().min(1).nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    notes: z.string().max(500).optional(),
    publish: z.boolean().optional(),
    isOpen: z.boolean().optional(),
  })
  .refine((v) => new Date(v.startsAt) < new Date(v.endsAt), {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
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
    return json(err('forbidden', 'You can’t edit that team’s schedule.'), { status: 403 });
  }

  // If assigning, make sure the assignee is actually on that team.
  if (parsed.data.userId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: parsed.data.userId,
        orgId: ctx.orgId,
        OR: [{ teamId: parsed.data.teamId }, { role: { not: 'EMPLOYEE' } }],
      },
      select: { id: true },
    });
    if (!membership) {
      return json(err('invalid_assignee', 'That user isn’t on this team.'), { status: 400 });
    }
  }

  const shift = await prisma.shift.create({
    data: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId,
      userId: parsed.data.isOpen ? null : parsed.data.userId ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      notes: parsed.data.notes ?? null,
      published: !!parsed.data.publish,
      isOpen: !!parsed.data.isOpen,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift.created',
    entity: 'Shift',
    entityId: shift.id,
    metadata: { teamId: shift.teamId, published: shift.published },
  });

  return json(ok(shift), { status: 201 });
}
