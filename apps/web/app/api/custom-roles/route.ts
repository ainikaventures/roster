import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { PERMISSIONS, type Permission } from '@/lib/permissions';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const roles = await prisma.customRole.findMany({
    where: { orgId: ctx.orgId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      updatedAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return json(ok(roles));
}

const PERM_SET = new Set<Permission>(PERMISSIONS);

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string()).max(80),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const filtered = parsed.data.permissions.filter((p) => PERM_SET.has(p as Permission));

  const role = await prisma.customRole.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      permissions: filtered as never,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'custom_role.created',
    entity: 'CustomRole',
    entityId: role.id,
    metadata: { name: role.name, permissionCount: filtered.length },
  });

  return json(ok(role), { status: 201 });
}
