import { prisma } from '@roster/db';
import { authPublic, ok, publicJson, requireScope } from '@/lib/public-api';

// GET /api/v1/users — list members in scope. Scope: read:users.
export async function GET(req: Request) {
  const ctx = await authPublic(req);
  if (ctx instanceof Response) return ctx;
  const blocked = requireScope(ctx, 'read:users');
  if (blocked) return blocked;

  const memberships = await prisma.membership.findMany({
    where: {
      orgId: ctx.orgId,
      ...(ctx.scope.teamIds && ctx.scope.role !== 'OWNER'
        ? { teamId: { in: ctx.scope.teamIds } }
        : {}),
    },
    select: {
      role: true,
      teamId: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return publicJson(ok({ items: memberships, count: memberships.length }));
}
