import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/time-off?status=&mine=&approvedOnly=
// Employees: see their own requests.
// Managers: see requests across their scope.
// ---------------------------------------------------------------------------

const Query = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELED']).optional(),
  mine: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  approvedOnly: z
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
    mine: url.searchParams.get('mine') ?? undefined,
    approvedOnly: url.searchParams.get('approvedOnly') ?? undefined,
  });
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  // Determine who we're listing requests for.
  let scopedUserIds: string[] | null = null;
  if (parsed.data.mine || !isManager(ctx.scope.role)) {
    scopedUserIds = [ctx.userId];
  } else if (ctx.scope.teamIds !== null) {
    const members = await prisma.membership.findMany({
      where: { orgId: ctx.orgId, teamId: { in: ctx.scope.teamIds } },
      select: { userId: true },
    });
    scopedUserIds = members.map((m) => m.userId);
  }

  const requests = await prisma.timeOffRequest.findMany({
    where: {
      orgId: ctx.orgId,
      ...(scopedUserIds ? { userId: { in: scopedUserIds } } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.approvedOnly ? { status: 'APPROVED' } : {}),
    },
    orderBy: [{ startsAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      userId: true,
      type: true,
      startsAt: true,
      endsAt: true,
      hours: true,
      reason: true,
      status: true,
      reviewerId: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  return json(ok(requests));
}

// ---------------------------------------------------------------------------
// POST /api/time-off — submit a request.
// ---------------------------------------------------------------------------

const CreateBody = z
  .object({
    type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID', 'OTHER']).default('VACATION'),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().max(2000).optional(),
  })
  .refine((v) => new Date(v.startsAt) <= new Date(v.endsAt), {
    message: 'startsAt must be on or before endsAt',
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

  // Hours: each calendar day (inclusive) counts as 8 hours by default.
  // Refined per-org workday-length is a Phase 6+ enhancement.
  const start = new Date(parsed.data.startsAt);
  const end = new Date(parsed.data.endsAt);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(
    1,
    Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs) + 1,
  );
  const hours = days * 8;

  const request = await prisma.timeOffRequest.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      type: parsed.data.type,
      startsAt: start,
      endsAt: end,
      hours,
      reason: parsed.data.reason ?? null,
    },
  });

  // Notify managers who can approve.
  const managers = await prisma.membership.findMany({
    where: {
      orgId: ctx.orgId,
      role: { in: ['OWNER', 'ADMIN', 'BRANCH_MANAGER', 'TEAM_MANAGER'] },
    },
    select: { userId: true },
  });

  await Promise.all(
    managers
      .filter((m) => m.userId !== ctx.userId)
      .map((m) =>
        notify({
          orgId: ctx.orgId,
          userId: m.userId,
          kind: 'system',
          title: 'New time-off request',
          body: `${request.hours / 8}-day request awaiting approval`,
          url: '/app/hr/time-off',
        }),
      ),
  );

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time_off.requested',
    entity: 'TimeOffRequest',
    entityId: request.id,
  });

  return json(ok(request), { status: 201 });
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
