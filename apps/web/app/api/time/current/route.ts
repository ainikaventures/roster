import { prisma } from '@roster/db';
import { ctxOr401, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/time/current — returns the user's open time entry (if any),
// including any open break. Used by the clock-in/out widget.
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const entry = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    orderBy: { clockedIn: 'desc' },
    select: {
      id: true,
      teamId: true,
      clockedIn: true,
      clockedOut: true,
      breaks: {
        orderBy: { startedAt: 'desc' },
        select: { id: true, startedAt: true, endedAt: true, paid: true },
      },
    },
  });

  return json(ok({ entry }));
}
