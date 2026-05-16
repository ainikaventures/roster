import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

const Body = z.object({
  teamId: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/time/clock-in
// Refuses to start a new entry if one is already open.
// Employees clock in to their assigned team automatically; managers may
// optionally pass a teamId (they often cover multiple teams).
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Already clocked in?
  const open = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    select: { id: true },
  });
  if (open) {
    return json(err('already_clocked_in', 'You’re already clocked in.'), { status: 409 });
  }

  // Determine team.
  let teamId = parsed.data.teamId;
  if (!teamId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: ctx.userId, orgId: ctx.orgId } },
      select: { teamId: true },
    });
    teamId = membership?.teamId ?? undefined;
  }

  if (!teamId) {
    return json(err('no_team', 'No team to clock into. Pass teamId.'), { status: 400 });
  }

  // Verify scope can clock into this team.
  if (ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(teamId)) {
    return json(err('forbidden', 'You can’t clock into that team.'), { status: 403 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      orgId: ctx.orgId,
      teamId,
      userId: ctx.userId,
      clockedIn: new Date(),
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time.clocked_in',
    entity: 'TimeEntry',
    entityId: entry.id,
    metadata: { teamId },
  });

  return json(ok(entry));
}
