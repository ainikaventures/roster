import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// GET /api/kudos?userId=&limit=
// Defaults to the org-wide feed.
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)),
  );

  const items = await prisma.kudos.findMany({
    where: {
      orgId: ctx.orgId,
      ...(userId ? { OR: [{ toUserId: userId }, { fromUserId: userId }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      message: true,
      points: true,
      category: true,
      createdAt: true,
      fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // Also compute the top-N leaderboard for the dashboard widget.
  const leaderboardRaw = await prisma.kudos.groupBy({
    by: ['toUserId'],
    where: { orgId: ctx.orgId },
    _sum: { points: true },
    _count: { _all: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 10,
  });
  const userIds = leaderboardRaw.map((r) => r.toUserId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
    : [];
  const usersById = new Map(users.map((u) => [u.id, u]));
  const leaderboard = leaderboardRaw.map((row) => ({
    user: usersById.get(row.toUserId)!,
    points: row._sum.points ?? 0,
    count: row._count._all,
  }));

  return json(ok({ items, leaderboard }));
}

const Body = z.object({
  toUserId: z.string().min(1),
  message: z.string().trim().min(1).max(500),
  points: z.number().int().min(0).max(100).default(5),
  category: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  if (parsed.data.toUserId === ctx.userId) {
    return json(err('invalid_input', 'Pick a teammate, not yourself.'), { status: 400 });
  }

  // Same-org check.
  const target = await prisma.membership.findFirst({
    where: { userId: parsed.data.toUserId, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!target) {
    return json(err('not_found', 'That teammate isn’t in this workspace.'), { status: 404 });
  }

  const kudos = await prisma.kudos.create({
    data: {
      orgId: ctx.orgId,
      fromUserId: ctx.userId,
      toUserId: parsed.data.toUserId,
      message: parsed.data.message,
      points: parsed.data.points,
      category: parsed.data.category ?? null,
    },
  });

  await notify({
    orgId: ctx.orgId,
    userId: parsed.data.toUserId,
    kind: 'system',
    title: 'You got kudos',
    body: parsed.data.message.slice(0, 140),
    url: '/app/kudos',
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'kudos.given',
    entity: 'Kudos',
    entityId: kudos.id,
    metadata: { toUserId: parsed.data.toUserId, points: parsed.data.points },
  });

  return json(ok(kudos), { status: 201 });
}
