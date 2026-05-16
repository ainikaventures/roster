import { z } from 'zod';
import { prisma } from '@roster/db';
import { ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/time/entries?from=&to=&userId=&teamId=&onlyMine=
//
// - Employees: forced to userId = self.
// - Managers: see all entries within their scope; can filter by userId/teamId.
// ---------------------------------------------------------------------------

const Query = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  onlyMine: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    userId: url.searchParams.get('userId') ?? undefined,
    teamId: url.searchParams.get('teamId') ?? undefined,
    onlyMine: url.searchParams.get('onlyMine') ?? undefined,
  });
  if (!parsed.success) {
    return json(err('invalid_input', 'Missing or invalid from/to'), { status: 400 });
  }

  const scopedToSelf = !isManager(ctx.scope.role) || parsed.data.onlyMine;
  const teamFilter =
    ctx.scope.teamIds === null
      ? { team: { branch: { orgId: ctx.orgId } } }
      : { teamId: { in: ctx.scope.teamIds } };

  const entries = await prisma.timeEntry.findMany({
    where: {
      orgId: ctx.orgId,
      ...teamFilter,
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : {}),
      ...(scopedToSelf
        ? { userId: ctx.userId }
        : parsed.data.userId
          ? { userId: parsed.data.userId }
          : {}),
      clockedIn: { gte: new Date(parsed.data.from) },
      AND: [
        {
          OR: [
            { clockedOut: { lte: new Date(parsed.data.to) } },
            { clockedOut: null },
          ],
        },
      ],
    },
    orderBy: { clockedIn: 'desc' },
    select: {
      id: true,
      teamId: true,
      userId: true,
      clockedIn: true,
      clockedOut: true,
      approved: true,
      notes: true,
      team: { select: { name: true, color: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      breaks: { select: { id: true, startedAt: true, endedAt: true, paid: true } },
    },
  });

  return json(ok(entries));
}
