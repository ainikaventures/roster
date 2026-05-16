import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// DELETE /api/documents/:id — archive (soft delete) so signatures + audit
// trail survive. Owners can delete their own personal docs; managers can
// delete any doc in their scope.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const doc = await prisma.document.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, ownerId: true, title: true },
  });
  if (!doc) return json(err('not_found', 'Document not found.'), { status: 404 });

  if (doc.ownerId !== ctx.userId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Not allowed.'), { status: 403 });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { archivedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'document.archived',
    entity: 'Document',
    entityId: doc.id,
    metadata: { title: doc.title },
  });

  return json(ok({ id: doc.id }));
}
