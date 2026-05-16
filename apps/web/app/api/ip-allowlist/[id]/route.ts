import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const entry = await prisma.ipAllowlistEntry.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, cidr: true },
  });
  if (!entry) return json(err('not_found', 'Not found.'), { status: 404 });

  await prisma.ipAllowlistEntry.delete({ where: { id: entry.id } });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'ip_allowlist.removed',
    entity: 'IpAllowlistEntry',
    entityId: entry.id,
    metadata: { cidr: entry.cidr },
  });

  return json(ok({ id: entry.id }));
}
