import { z } from 'zod';
import { prisma } from '@roster/db';
import {
  authPublic,
  err,
  ok,
  publicJson,
  requireScope,
} from '@/lib/public-api';

// ---------------------------------------------------------------------------
// GET /api/v1/shifts
// Public read of shifts. Scopes: read:shifts.
// Query: ?from=&to=&teamId=&userId=
// ---------------------------------------------------------------------------

const Query = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  teamId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 100, 1), 500) : 100)),
});

export async function GET(req: Request) {
  const ctx = await authPublic(req);
  if (ctx instanceof Response) return ctx;
  const blocked = requireScope(ctx, 'read:shifts');
  if (blocked) return blocked;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    teamId: url.searchParams.get('teamId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return publicJson(err('invalid_input', 'Missing or invalid from/to'), { status: 400 });
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
      ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      startsAt: { gte: new Date(parsed.data.from) },
      endsAt: { lte: new Date(parsed.data.to) },
    },
    orderBy: { startsAt: 'asc' },
    take: parsed.data.limit,
    select: {
      id: true,
      teamId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      published: true,
      isOpen: true,
    },
  });

  return publicJson(ok({ items: shifts, count: shifts.length }));
}
