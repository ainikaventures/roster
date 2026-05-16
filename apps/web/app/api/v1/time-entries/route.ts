import { z } from 'zod';
import { prisma } from '@roster/db';
import {
  authPublic,
  err,
  ok,
  publicJson,
  requireScope,
} from '@/lib/public-api';

const Query = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  teamId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  approvedOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

// GET /api/v1/time-entries — Scope: read:time_entries.
// Common use case: payroll integration pulls approved entries on a schedule.
export async function GET(req: Request) {
  const ctx = await authPublic(req);
  if (ctx instanceof Response) return ctx;
  const blocked = requireScope(ctx, 'read:time_entries');
  if (blocked) return blocked;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    teamId: url.searchParams.get('teamId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    approvedOnly: url.searchParams.get('approvedOnly') ?? undefined,
  });
  if (!parsed.success) {
    return publicJson(err('invalid_input', 'Missing or invalid from/to'), { status: 400 });
  }

  const teamFilter =
    ctx.scope.teamIds === null
      ? { team: { branch: { orgId: ctx.orgId } } }
      : { teamId: { in: ctx.scope.teamIds } };

  const entries = await prisma.timeEntry.findMany({
    where: {
      orgId: ctx.orgId,
      ...teamFilter,
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : {}),
      ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      ...(parsed.data.approvedOnly ? { approved: true } : {}),
      clockedIn: { gte: new Date(parsed.data.from) },
      clockedOut: { not: null, lte: new Date(parsed.data.to) },
    },
    orderBy: { clockedIn: 'asc' },
    take: 500,
    select: {
      id: true,
      teamId: true,
      userId: true,
      clockedIn: true,
      clockedOut: true,
      approved: true,
      breaks: { select: { startedAt: true, endedAt: true, paid: true } },
    },
  });

  return publicJson(ok({ items: entries, count: entries.length }));
}
