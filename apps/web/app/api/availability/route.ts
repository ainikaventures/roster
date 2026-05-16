import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// GET /api/availability?userId= — own or (for managers) someone in scope.
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const targetId = url.searchParams.get('userId') ?? ctx.userId;
  if (targetId !== ctx.userId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Not allowed.'), { status: 403 });
  }

  const rows = await prisma.availability.findMany({
    where: { orgId: ctx.orgId, userId: targetId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
    select: {
      id: true,
      userId: true,
      teamId: true,
      dayOfWeek: true,
      startMinutes: true,
      endMinutes: true,
      kind: true,
      note: true,
    },
  });

  return json(ok(rows));
}

// POST /api/availability — create or replace one window.
const Body = z
  .object({
    teamId: z.string().min(1).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(0).max(1439),
    kind: z.enum(['AVAILABLE', 'UNAVAILABLE', 'PREFERRED']).default('AVAILABLE'),
    note: z.string().max(280).optional(),
  })
  .refine((v) => v.startMinutes < v.endMinutes, {
    message: 'endMinutes must be greater than startMinutes',
    path: ['endMinutes'],
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

  const row = await prisma.availability.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      teamId: parsed.data.teamId ?? null,
      dayOfWeek: parsed.data.dayOfWeek,
      startMinutes: parsed.data.startMinutes,
      endMinutes: parsed.data.endMinutes,
      kind: parsed.data.kind,
      note: parsed.data.note ?? null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'availability.added',
    entity: 'Availability',
    entityId: row.id,
  });

  return json(ok(row), { status: 201 });
}
