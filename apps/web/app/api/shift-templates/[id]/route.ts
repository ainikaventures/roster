import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const tmpl = await prisma.shiftTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!tmpl) return json(err('not_found', 'Template not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, tmpl.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  await prisma.shiftTemplate.delete({ where: { id: tmpl.id } });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift_template.deleted',
    entity: 'ShiftTemplate',
    entityId: tmpl.id,
  });

  return json(ok({ id: tmpl.id }));
}

// POST /api/shift-templates/:id/apply — materialize this template into a
// specific calendar week as draft shifts.
import { z } from 'zod';

const ApplyBody = z.object({
  weekStartIso: z.string().datetime(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const tmpl = await prisma.shiftTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      teamId: true,
      dayOfWeek: true,
      startMinutes: true,
      endMinutes: true,
      defaultUserId: true,
      notes: true,
    },
  });
  if (!tmpl) return json(err('not_found', 'Template not found.'), { status: 404 });
  if (!canWriteToTeam(ctx.scope, tmpl.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const parsed = ApplyBody.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const weekStart = new Date(parsed.data.weekStartIso);
  weekStart.setHours(0, 0, 0, 0);
  // weekStart should be a Monday in our convention; advance to the template's
  // dayOfWeek. We use 0 = Sunday so offset of (dayOfWeek + 6) % 7 from Monday.
  const offset = (tmpl.dayOfWeek + 6) % 7;
  const day = new Date(weekStart);
  day.setDate(weekStart.getDate() + offset);

  const start = new Date(day);
  start.setMinutes(tmpl.startMinutes);
  const end = new Date(day);
  end.setMinutes(tmpl.endMinutes);

  const shift = await prisma.shift.create({
    data: {
      orgId: ctx.orgId,
      teamId: tmpl.teamId,
      userId: tmpl.defaultUserId,
      startsAt: start,
      endsAt: end,
      notes: tmpl.notes,
      published: false,
      isOpen: tmpl.defaultUserId == null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift_template.applied',
    entity: 'Shift',
    entityId: shift.id,
    metadata: { templateId: tmpl.id, weekStart: parsed.data.weekStartIso },
  });

  return json(ok(shift), { status: 201 });
}
