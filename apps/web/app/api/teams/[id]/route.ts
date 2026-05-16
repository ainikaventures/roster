import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, json, ok } from '@/lib/api';

// PATCH /api/teams/:id — manager-side team settings.
// Phase 6 exposes geofence + selfie requirements; renaming + color editing
// can ride on this endpoint later without breaking compatibility.
const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadius: z.number().int().min(10).max(20_000).nullable().optional(),
  requireSelfieClockIn: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!canWriteToTeam(ctx.scope, params.id)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }

  const team = await prisma.team.findFirst({
    where: { id: params.id, branch: { orgId: ctx.orgId } },
    select: { id: true },
  });
  if (!team) return json(err('not_found', 'Team not found.'), { status: 404 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    if (parsed.data[key] !== undefined) data[key] = parsed.data[key];
  }

  const updated = await prisma.team.update({ where: { id: team.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'team.updated',
    entity: 'Team',
    entityId: team.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}
