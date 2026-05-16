import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// DELETE /api/api-keys/:id — revoke (soft) so audit trail survives.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const key = await prisma.apiKey.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, prefix: true, revokedAt: true },
  });
  if (!key) return json(err('not_found', 'Key not found.'), { status: 404 });
  if (key.revokedAt) return json(ok({ id: key.id }));

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'api_key.revoked',
    entity: 'ApiKey',
    entityId: key.id,
    metadata: { prefix: key.prefix },
  });

  return json(ok({ id: key.id }));
}
