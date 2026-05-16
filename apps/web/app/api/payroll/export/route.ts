import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json } from '@/lib/api';
import { entriesToCsv } from '@/lib/payroll';

// GET /api/payroll/export?from=&to=&teamId=&approvedOnly=
// Returns a CSV stream of all completed TimeEntry rows in scope.
const Query = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  teamId: z.string().min(1).optional(),
  approvedOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    teamId: url.searchParams.get('teamId') ?? undefined,
    approvedOnly: url.searchParams.get('approvedOnly') ?? undefined,
  });
  if (!parsed.success) {
    return json(err('invalid_input', 'Missing or invalid from/to'), { status: 400 });
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
      ...(parsed.data.approvedOnly ? { approved: true } : {}),
      clockedIn: { gte: new Date(parsed.data.from) },
      clockedOut: { not: null, lte: new Date(parsed.data.to) },
    },
    orderBy: [{ user: { name: 'asc' } }, { clockedIn: 'asc' }],
    select: {
      id: true,
      userId: true,
      teamId: true,
      clockedIn: true,
      clockedOut: true,
      approved: true,
      user: { select: { name: true, email: true } },
      team: { select: { name: true } },
      breaks: { select: { startedAt: true, endedAt: true, paid: true } },
    },
  });

  const csv = entriesToCsv(
    entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      teamId: e.teamId,
      clockedIn: e.clockedIn,
      clockedOut: e.clockedOut,
      user: e.user,
      team: e.team,
      breaks: e.breaks.map((b) => ({
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        paid: b.paid,
      })),
      // entriesToCsv reads `approved` off the row via an optional field.
      // Spread keeps it on the result.
      ...({ approved: e.approved } as { approved: boolean }),
    })),
  );

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'payroll.exported',
    entity: 'Organization',
    entityId: ctx.orgId,
    metadata: { from: parsed.data.from, to: parsed.data.to, rows: entries.length },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="roster-payroll-${parsed.data.from.slice(0, 10)}.csv"`,
    },
  });
}
