import { z } from 'zod';
import { prisma, notifyTeam } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, json, ok } from '@/lib/api';
import { emitWebhookEvent } from '@/lib/webhooks';

// ---------------------------------------------------------------------------
// POST /api/shifts/publish
// Bulk-publish all draft shifts in a team within a date range.
// Triggers in-app notifications to that team's employees.
// ---------------------------------------------------------------------------

const Body = z.object({
  teamId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  if (!canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'You can’t publish that team’s schedule.'), {
      status: 403,
    });
  }

  const team = await prisma.team.findFirst({
    where: { id: parsed.data.teamId, branch: { orgId: ctx.orgId } },
    select: { id: true, name: true, branch: { select: { name: true } } },
  });
  if (!team) return json(err('not_found', 'Team not found.'), { status: 404 });

  const result = await prisma.shift.updateMany({
    where: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId,
      published: false,
      startsAt: { gte: new Date(parsed.data.from) },
      endsAt: { lte: new Date(parsed.data.to) },
    },
    data: { published: true },
  });

  if (result.count > 0) {
    await notifyTeam({
      orgId: ctx.orgId,
      teamId: team.id,
      actorUserId: ctx.userId,
      kind: 'shift.published',
      title: `Schedule published for ${team.name}`,
      body: `${result.count} shift${result.count === 1 ? '' : 's'} published.`,
      url: '/app/schedule',
    });

    await audit({
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: 'shifts.published',
      entity: 'Team',
      entityId: team.id,
      metadata: { count: result.count, from: parsed.data.from, to: parsed.data.to },
    });

    await emitWebhookEvent(ctx.orgId, 'shift.published', {
      teamId: team.id,
      teamName: team.name,
      count: result.count,
      from: parsed.data.from,
      to: parsed.data.to,
    });
  }

  return json(ok({ published: result.count }));
}
