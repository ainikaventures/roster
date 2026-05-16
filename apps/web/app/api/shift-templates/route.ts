import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

const Body = z
  .object({
    teamId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(0).max(1439),
    defaultUserId: z.string().min(1).nullable().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.startMinutes < v.endMinutes, {
    message: 'endMinutes must be greater than startMinutes',
    path: ['endMinutes'],
  });

// GET /api/shift-templates?teamId=
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const teamId = url.searchParams.get('teamId');

  const teamFilter =
    ctx.scope.teamIds === null
      ? { team: { branch: { orgId: ctx.orgId } } }
      : { teamId: { in: ctx.scope.teamIds } };

  const templates = await prisma.shiftTemplate.findMany({
    where: {
      orgId: ctx.orgId,
      ...teamFilter,
      ...(teamId ? { teamId } : {}),
    },
    orderBy: [{ teamId: 'asc' }, { dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
    select: {
      id: true,
      name: true,
      teamId: true,
      dayOfWeek: true,
      startMinutes: true,
      endMinutes: true,
      defaultUserId: true,
      notes: true,
      team: { select: { id: true, name: true, color: true } },
    },
  });

  return json(ok(templates));
}

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }
  if (!canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const tmpl = await prisma.shiftTemplate.create({
    data: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId,
      name: parsed.data.name,
      dayOfWeek: parsed.data.dayOfWeek,
      startMinutes: parsed.data.startMinutes,
      endMinutes: parsed.data.endMinutes,
      defaultUserId: parsed.data.defaultUserId ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'shift_template.created',
    entity: 'ShiftTemplate',
    entityId: tmpl.id,
  });

  return json(ok(tmpl), { status: 201 });
}
