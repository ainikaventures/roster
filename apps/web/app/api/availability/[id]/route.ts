import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const row = await prisma.availability.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, userId: true },
  });
  if (!row) return json(err('not_found', 'Not found.'), { status: 404 });
  if (row.userId !== ctx.userId) {
    return json(err('forbidden', 'You can only edit your own availability.'), {
      status: 403,
    });
  }

  await prisma.availability.delete({ where: { id: row.id } });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'availability.removed',
    entity: 'Availability',
    entityId: row.id,
  });

  return json(ok({ id: row.id }));
}
